"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const fse = require("fs-extra");
const child_process_1 = require("child_process");
const csv = require("csv-parser");
const stream_1 = require("stream");
const util_1 = require("util");
const fsCopy = util_1.promisify(fs.copyFile);
const readFile = util_1.promisify(fs.readFile);
class Paster {
    constructor(extension) {
        // Image pasting code below from https://github.com/mushanshitiancai/vscode-paste-image/
        // Copyright 2016 mushanshitiancai
        // Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
        // The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
        // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
        this.PATH_VARIABLE_GRAPHICS_PATH = /\$\{graphicsPath\}/g;
        this.PATH_VARIABLE_CURRNET_FILE_DIR = /\$\{currentFileDir\}/g;
        this.PATH_VARIABLE_IMAGE_FILE_PATH = /\$\{imageFilePath\}/g;
        this.PATH_VARIABLE_IMAGE_FILE_PATH_WITHOUT_EXT = /\$\{imageFilePathWithoutExt\}/g;
        this.PATH_VARIABLE_IMAGE_FILE_NAME = /\$\{imageFileName\}/g;
        this.PATH_VARIABLE_IMAGE_FILE_NAME_WITHOUT_EXT = /\$\{imageFileNameWithoutExt\}/g;
        this.pasteTemplate = '';
        this.basePathConfig = '${graphicsPath}';
        this.graphicsPathFallback = '${currentFileDir}';
        this.extension = extension;
    }
    async paste() {
        this.extension.logger.addLogMessage('Performing formatted paste');
        // get current edit file path
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const fileUri = editor.document.uri;
        if (!fileUri) {
            return;
        }
        const clipboardContents = await vscode.env.clipboard.readText();
        // if empty try pasting an image from clipboard
        if (clipboardContents === '') {
            if (fileUri.scheme === 'untitled') {
                vscode.window.showInformationMessage('You need to the save the current editor before pasting an image');
                return;
            }
            this.pasteImage(editor, fileUri.fsPath);
        }
        if (clipboardContents.split('\n').length === 1) {
            let filePath;
            let basePath;
            if (fileUri.scheme === 'untitled') {
                filePath = clipboardContents;
                basePath = '';
            }
            else {
                filePath = path.resolve(fileUri.fsPath, clipboardContents);
                basePath = fileUri.fsPath;
            }
            if (fs.existsSync(filePath)) {
                await this.pasteFile(editor, basePath, clipboardContents);
                return;
            }
        }
        // if not pasting file
        try {
            await this.pasteTable(editor, clipboardContents);
        }
        catch (error) {
            this.pasteNormal(editor, this.reformatText(clipboardContents, true, vscode.workspace.getConfiguration('latex-utilities.formattedPaste').get('maxLineLength'), editor));
            this.extension.telemetryReporter.sendTelemetryEvent('formattedPaste', { type: 'text' });
        }
    }
    pasteNormal(editor, content) {
        editor.edit(edit => {
            const current = editor.selection;
            if (current.isEmpty) {
                edit.insert(current.start, content);
            }
            else {
                edit.replace(current, content);
            }
        });
    }
    async pasteFile(editor, baseFile, file) {
        const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.eps', '.pdf'];
        const TABLE_FORMATS = ['.csv'];
        const extension = path.extname(file);
        if (IMAGE_EXTENSIONS.indexOf(extension) !== -1) {
            this.pasteImage(editor, baseFile, file);
        }
        else if (TABLE_FORMATS.indexOf(extension) !== -1) {
            if (extension === '.csv') {
                const fileContent = await readFile(path.resolve(baseFile, file));
                await this.pasteTable(editor, fileContent.toString());
            }
        }
    }
    async pasteTable(editor, content, delimiter) {
        this.extension.logger.addLogMessage('Pasting: Table');
        const configuration = vscode.workspace.getConfiguration('latex-utilities.formattedPaste');
        const columnDelimiter = delimiter || configuration.customTableDelimiter;
        const columnType = configuration.tableColumnType;
        const booktabs = configuration.tableBooktabsStyle;
        const headerRows = configuration.tableHeaderRows;
        const trimUnwantedWhitespace = (s) => s
            .replace(/\r\n/g, '\n')
            .replace(/^[^\S\t]+|[^\S\t]+$/gm, '')
            .replace(/^[\uFEFF\xA0]+|[\uFEFF\xA0]+$/gm, '');
        content = trimUnwantedWhitespace(content);
        const TEST_DELIMITERS = new Set([columnDelimiter, '\t', ',', '|']);
        const tables = [];
        for (const testDelimiter of TEST_DELIMITERS) {
            try {
                const table = await this.processTable(content, testDelimiter);
                tables.push(table);
                this.extension.logger.addLogMessage(`Successfully found ${testDelimiter} delimited table`);
            }
            catch (e) { }
        }
        if (tables.length === 0) {
            this.extension.logger.addLogMessage('No table found');
            if (configuration.tableDelimiterPrompt) {
                const columnDelimiterNew = await vscode.window.showInputBox({
                    prompt: 'Please specify the table cell delimiter',
                    value: columnDelimiter,
                    placeHolder: columnDelimiter,
                    validateInput: (text) => {
                        return text === '' ? 'No delimiter specified!' : null;
                    }
                });
                if (columnDelimiterNew === undefined) {
                    throw new Error('no table cell delimiter set');
                }
                try {
                    const table = await this.processTable(content, columnDelimiterNew);
                    tables.push(table);
                    this.extension.logger.addLogMessage(`Successfully found ${columnDelimiterNew} delimited table`);
                }
                catch (e) {
                    vscode.window.showWarningMessage(e);
                    throw Error('Unable to identify table');
                }
            }
            else {
                throw Error('Unable to identify table');
            }
        }
        // put the 'biggest' table first
        tables.sort((a, b) => a.length * a[0].length - b.length * b[0].length);
        const table = tables[0].map(row => row.map(cell => this.reformatText(cell.replace(/^\s+|\s+$/gm, ''), false)));
        const tabularRows = table.map(row => '\t' + row.join(' & '));
        if (headerRows && tabularRows.length > headerRows) {
            const eol = editor.document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
            const headSep = '\t' + (booktabs ? '\\midrule' : '\\hline') + eol;
            tabularRows[headerRows] = headSep + tabularRows[headerRows];
        }
        let tabularContents = tabularRows.join(' \\\\\n');
        if (booktabs) {
            tabularContents = '\t\\toprule\n' + tabularContents + ' \\\\\n\t\\bottomrule';
        }
        const tabular = `\\begin{tabular}{${columnType.repeat(table[0].length)}}\n${tabularContents}\n\\end{tabular}`;
        editor.edit(edit => {
            const current = editor.selection;
            if (current.isEmpty) {
                edit.insert(current.start, tabular);
            }
            else {
                edit.replace(current, tabular);
            }
        });
        this.extension.telemetryReporter.sendTelemetryEvent('formattedPaste', { type: 'table' });
    }
    processTable(content, delimiter = ',') {
        const isConsistent = (rows) => {
            return rows.reduce((accumulator, current, _index, array) => {
                if (current.length === array[0].length) {
                    return accumulator;
                }
                else {
                    return false;
                }
            }, true);
        };
        // if table is flanked by empty rows/columns, remove them
        const trimSides = (rows) => {
            const emptyTop = rows[0].reduce((a, c) => c + a, '') === '';
            const emptyBottom = rows[rows.length - 1].reduce((a, c) => c + a, '') === '';
            const emptyLeft = rows.reduce((a, c) => a + c[0], '') === '';
            const emptyRight = rows.reduce((a, c) => a + c[c.length - 1], '') === '';
            if (!(emptyTop || emptyBottom || emptyLeft || emptyRight)) {
                return rows;
            }
            else {
                if (emptyTop) {
                    rows.shift();
                }
                if (emptyBottom) {
                    rows.pop();
                }
                if (emptyLeft) {
                    rows.forEach(row => row.shift());
                }
                if (emptyRight) {
                    rows.forEach(row => row.pop());
                }
                return trimSides(rows);
            }
        };
        return new Promise((resolve, reject) => {
            let rows = [];
            const contentStream = new stream_1.Readable();
            // if markdown / org mode / ascii table we want to strip some rows
            if (delimiter === '|') {
                const removeRowsRegex = /^\s*[-+:| ]+\s*$/;
                const lines = content.split('\n').filter(l => !removeRowsRegex.test(l));
                content = lines.join('\n');
            }
            contentStream.push(content);
            contentStream.push(null);
            contentStream
                .pipe(csv({ headers: false, separator: delimiter }))
                .on('data', (data) => rows.push(Object.values(data)))
                .on('end', () => {
                rows = trimSides(rows);
                // determine if all rows have same number of cells
                if (!isConsistent(rows)) {
                    reject('Table is not consistent');
                }
                else if (rows.length === 1 || rows[0].length === 1) {
                    reject("Doesn't look like a table");
                }
                resolve(rows);
            });
        });
    }
    reformatText(text, removeBonusWhitespace = true, maxLineLength = null, editor) {
        function doRemoveBonusWhitespace(str) {
            str = str.replace(/\u200B/g, ''); // get rid of zero-width spaces
            str = str.replace(/\n{2,}/g, '\uE000'); // 'save' multi-newlines to private use character
            str = str.replace(/\s+/g, ' '); // replace all whitespace with normal space
            str = str.replace(/\uE000/g, '\n\n'); // re-insert multi-newlines
            str = str.replace(/\uE001/g, '\n'); // this has been used as 'saved' whitespace
            str = str.replace(/\uE002/g, '\t'); // this has been used as 'saved' whitespace
            str = str.replace(/^\s+|\s+$/g, '');
            return str;
        }
        function fitToLineLength(lineLength, str, splitChars = [' ', ',', '.', ':', ';', '?', '!']) {
            const lines = [];
            const indent = editor
                ? editor.document.lineAt(editor.selection.start.line).text.replace(/^(\s*).*/, '$1')
                : '';
            let lastNewlinePosition = editor ? -editor.selection.start.character : 0;
            let lastSplitCharPosition = 0;
            let i;
            for (i = 0; i < str.length; i++) {
                if (str[i] === '\n') {
                    lines.push((lines.length > 0 ? indent : '') +
                        str
                            .slice(Math.max(0, lastNewlinePosition), i)
                            .replace(/^[^\S\t]+/, '')
                            .replace(/\s+$/, ''));
                    lastNewlinePosition = i;
                }
                if (splitChars.indexOf(str[i]) !== -1) {
                    lastSplitCharPosition = i + 1;
                }
                if (i - lastNewlinePosition >= lineLength - indent.length) {
                    lines.push((lines.length > 0 ? indent : '') +
                        str
                            .slice(Math.max(0, lastNewlinePosition), lastSplitCharPosition)
                            .replace(/^[^\S\t]+/, '')
                            .replace(/\s+$/, ''));
                    lastNewlinePosition = lastSplitCharPosition;
                    i = lastSplitCharPosition;
                }
            }
            if (lastNewlinePosition < i) {
                lines.push((lines.length > 0 ? indent : '') +
                    str
                        .slice(Math.max(0, lastNewlinePosition), i)
                        .replace(/^\s+/, '')
                        .replace(/\s+$/, ''));
            }
            console.log(lines.map(l => lineLength - l.length));
            return lines.join('\n');
        }
        // join hyphenated lines
        text = text.replace(/(\w+)-\s?$\s?\n(\w+)/gm, '$1$2\n');
        const textReplacements = {
            // escape latex special characters
            '\\\\': '\\textbackslash ',
            '&': '\\&',
            '%': '\\%',
            '\\$': '\\$',
            '#': '\\#',
            _: '\\_',
            '\\^': '\\textasciicircum ',
            '{': '\\{',
            '}': '\\}',
            '~': '\\textasciitilde ',
            // dumb quotes
            '\\B"([^"]+)"\\B': "``$1''",
            "\\B'([^']+)'\\B": "`$1'",
            // 'smart' quotes
            '“': '``',
            '”': "''",
            '‘': '`',
            '’': "'",
            // unicode symbols
            '—': '---',
            '–': '--',
            ' -- ': ' --- ',
            '−': '-',
            '…': '\\ldots ',
            '‐': '-',
            '™': '\\texttrademark ',
            '®': '\\textregistered ',
            '©': '\\textcopyright ',
            '¢': '\\cent ',
            '£': '\\pound ',
            // unicode math
            '×': '\\(\\times \\)',
            '÷': '\\(\\div \\)',
            '±': '\\(\\pm \\)',
            '→': '\\(\\to \\)',
            '(\\d*)° ?(C|F)?': '\\($1^\\circ $2\\)',
            '≤': '\\(\\leq \\)',
            '≥': '\\(\\geq \\)',
            // typographic approximations
            '\\.\\.\\.': '\\ldots ',
            '-{20,}': '\\hline',
            '-{2,3}>': '\\(\\longrightarrow \\)',
            '->': '\\(\\to \\)',
            '<-{2,3}': '\\(\\longleftarrow \\)',
            '<-': '\\(\\leftarrow \\)',
            // more latex stuff
            '\\b([A-Z]+)\\.\\s([A-Z])': '$1\\@. $2',
            '\\b(etc|ie|i\\.e|eg|e\\.g)\\.\\s(\\w)': '$1.\\ $2',
            // some funky unicode symbols that come up here and there
            '\\s?•\\s?': '\uE001\uE002\\item ',
            '\\n?((?:\\s*\uE002\\\\item .*)+)': '\uE001\\begin{itemize}\uE001$1\uE001\\end{itemize}\uE001',
            '': '<',
            '': '-',
            '': '>'
        };
        const texText = /\\[A-Za-z]{3,15}/;
        if (!texText.test(text)) {
            for (const pattern in textReplacements) {
                text = text.replace(new RegExp(pattern, 'gm'), textReplacements[pattern]);
            }
        }
        if (removeBonusWhitespace) {
            text = doRemoveBonusWhitespace(text);
        }
        if (maxLineLength !== null) {
            text = fitToLineLength(maxLineLength, text);
        }
        return text;
    }
    pasteImage(editor, baseFile, imgFile) {
        this.extension.logger.addLogMessage('Pasting: Image');
        const folderPath = path.dirname(baseFile);
        const projectPath = vscode.workspace.workspaceFolders
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : folderPath;
        // get selection as image file name, need check
        const selection = editor.selection;
        const selectText = editor.document.getText(selection);
        if (selectText && /\//.test(selectText)) {
            vscode.window.showInformationMessage('Your selection is not a valid file name!');
            return;
        }
        this.loadImageConfig(projectPath, baseFile);
        if (imgFile && !selectText) {
            const imagePath = this.renderImagePaste(path.dirname(baseFile), imgFile);
            if (!vscode.window.activeTextEditor) {
                return;
            }
            vscode.window.activeTextEditor.insertSnippet(new vscode.SnippetString(imagePath), editor.selection.start, {
                undoStopBefore: true,
                undoStopAfter: true
            });
            return;
        }
        this.getImagePath(baseFile, imgFile, selectText, this.basePathConfig, (_err, imagePath) => {
            try {
                // does the file exist?
                const existed = fs.existsSync(imagePath);
                if (existed) {
                    vscode.window
                        .showInformationMessage(`File ${imagePath} exists. Would you want to replace?`, 'Replace', 'Cancel')
                        .then(choose => {
                        if (choose !== 'Replace') {
                            return;
                        }
                        this.saveAndPaste(editor, imagePath, imgFile);
                    });
                }
                else {
                    this.saveAndPaste(editor, imagePath, imgFile);
                }
            }
            catch (err) {
                vscode.window.showErrorMessage(`fs.existsSync(${imagePath}) fail. message=${err.message}`);
                return;
            }
        });
    }
    loadImageConfig(projectPath, filePath) {
        const config = vscode.workspace.getConfiguration('latex-utilities.formattedPaste.image');
        // load other config
        const pasteTemplate = config.get('template');
        if (pasteTemplate === undefined) {
            throw new Error('No config value found for latex-utilities.imagePaste.template');
        }
        if (typeof pasteTemplate === 'string') {
            this.pasteTemplate = pasteTemplate;
        }
        else {
            // is multiline string represented by array
            this.pasteTemplate = pasteTemplate.join('\n');
        }
        this.graphicsPathFallback = this.replacePathVariables(this.graphicsPathFallback, projectPath, filePath);
        this.basePathConfig = this.replacePathVariables(this.basePathConfig, projectPath, filePath);
        this.pasteTemplate = this.replacePathVariables(this.pasteTemplate, projectPath, filePath);
    }
    getImagePath(filePath, imagePathCurrent = '', selectText, folderPathFromConfig, callback) {
        const graphicsPath = this.basePathConfig;
        const imgPostfixNumber = Math.max(0, ...fs
            .readdirSync(graphicsPath)
            .map(imagePath => parseInt(imagePath.replace(/^image(\d+)\.\w+/, '$1')))
            .filter(num => !isNaN(num))) + 1;
        const imgExtension = path.extname(imagePathCurrent) ? path.extname(imagePathCurrent) : '.png';
        const imageFileName = selectText ? selectText + imgExtension : `image${imgPostfixNumber}` + imgExtension;
        vscode.window
            .showInputBox({
            prompt: 'Please specify the filename of the image.',
            value: imageFileName,
            valueSelection: [imageFileName.length - imageFileName.length, imageFileName.length - 4]
        })
            .then(result => {
            if (result) {
                if (!result.endsWith(imgExtension)) {
                    result += imgExtension;
                }
                result = makeImagePath(result);
                callback(null, result);
            }
            return;
        });
        function makeImagePath(fileName) {
            // image output path
            const folderPath = path.dirname(filePath);
            let imagePath = '';
            // generate image path
            if (path.isAbsolute(folderPathFromConfig)) {
                imagePath = path.join(folderPathFromConfig, fileName);
            }
            else {
                imagePath = path.join(folderPath, folderPathFromConfig, fileName);
            }
            return imagePath;
        }
    }
    async saveAndPaste(editor, imgPath, oldPath) {
        this.ensureImgDirExists(imgPath)
            .then((imagePath) => {
            // save image and insert to current edit file
            if (oldPath) {
                fsCopy(oldPath, imagePath);
                const imageString = this.renderImagePaste(this.basePathConfig, imagePath);
                const current = editor.selection;
                if (!current.isEmpty) {
                    editor.edit(editBuilder => {
                        editBuilder.delete(current);
                    }, { undoStopBefore: true, undoStopAfter: false });
                }
                if (!vscode.window.activeTextEditor) {
                    return;
                }
                vscode.window.activeTextEditor.insertSnippet(new vscode.SnippetString(imageString), editor.selection.start, {
                    undoStopBefore: true,
                    undoStopAfter: true
                });
            }
            else {
                this.saveClipboardImageToFileAndGetPath(imagePath, (_imagePath, imagePathReturnByScript) => {
                    if (!imagePathReturnByScript) {
                        return;
                    }
                    if (imagePathReturnByScript === 'no image') {
                        vscode.window.showInformationMessage('No image in clipboard');
                        return;
                    }
                    const imageString = this.renderImagePaste(this.basePathConfig, imagePath);
                    const current = editor.selection;
                    if (!current.isEmpty) {
                        editor.edit(editBuilder => {
                            editBuilder.delete(current);
                        }, { undoStopBefore: true, undoStopAfter: false });
                    }
                    if (!vscode.window.activeTextEditor) {
                        return;
                    }
                    vscode.window.activeTextEditor.insertSnippet(new vscode.SnippetString(imageString), editor.selection.start, {
                        undoStopBefore: true,
                        undoStopAfter: true
                    });
                });
            }
            this.extension.telemetryReporter.sendTelemetryEvent('formattedPaste', { type: 'image' });
        })
            .catch((err) => {
            vscode.window.showErrorMessage(`Failed make folder. message=${err.message}`);
            return;
        });
    }
    ensureImgDirExists(imagePath) {
        return new Promise((resolve, reject) => {
            const imageDir = path.dirname(imagePath);
            fs.stat(imageDir, (error, stats) => {
                if (error === null) {
                    if (stats.isDirectory()) {
                        resolve(imagePath);
                    }
                    else {
                        reject(new Error(`The image destination directory '${imageDir}' is a file.`));
                    }
                }
                else if (error.code === 'ENOENT') {
                    fse.ensureDir(imageDir, undefined, err => {
                        if (err) {
                            reject(err);
                            return undefined;
                        }
                        resolve(imagePath);
                        return undefined;
                    });
                }
                else {
                    reject(error);
                }
            });
        });
    }
    // TODO: turn into async function, and raise errors internally
    saveClipboardImageToFileAndGetPath(imagePath, cb) {
        if (!imagePath) {
            return;
        }
        const platform = process.platform;
        if (platform === 'win32') {
            // Windows
            const scriptPath = path.join(this.extension.extensionRoot, './scripts/saveclipimg-pc.ps1');
            let command = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
            const powershellExisted = fs.existsSync(command);
            if (!powershellExisted) {
                command = 'powershell';
            }
            const powershell = child_process_1.spawn(command, [
                '-noprofile',
                '-noninteractive',
                '-nologo',
                '-sta',
                '-executionpolicy',
                'unrestricted',
                '-windowstyle',
                'hidden',
                '-file',
                scriptPath,
                imagePath
            ]);
            powershell.on('error', e => {
                if (e.name === 'ENOENT') {
                    vscode.window.showErrorMessage('The powershell command is not in you PATH environment variables.Please add it and retry.');
                }
                else {
                    console.log(e);
                    vscode.window.showErrorMessage(e.message);
                }
            });
            powershell.on('exit', (_code, _signal) => {
                // console.log('exit', code, signal);
            });
            powershell.stdout.on('data', (data) => {
                cb(imagePath, data.toString().trim());
            });
        }
        else if (platform === 'darwin') {
            // Mac
            const scriptPath = path.join(this.extension.extensionRoot, './scripts/saveclipimg-mac.applescript');
            const ascript = child_process_1.spawn('osascript', [scriptPath, imagePath]);
            ascript.on('error', e => {
                console.log(e);
                vscode.window.showErrorMessage(e.message);
            });
            ascript.on('exit', (_code, _signal) => {
                // console.log('exit',code,signal);
            });
            ascript.stdout.on('data', (data) => {
                cb(imagePath, data.toString().trim());
            });
        }
        else {
            // Linux
            const scriptPath = path.join(this.extension.extensionRoot, './scripts/saveclipimg-linux.sh');
            const ascript = child_process_1.spawn('sh', [scriptPath, imagePath]);
            ascript.on('error', e => {
                console.log(e);
                vscode.window.showErrorMessage(e.message);
            });
            ascript.on('exit', (_code, _signal) => {
                // console.log('exit',code,signal);
            });
            ascript.stdout.on('data', (data) => {
                const result = data.toString().trim();
                if (result === 'no xclip') {
                    vscode.window.showErrorMessage('You need to install xclip command first.');
                    return;
                }
                cb(imagePath, result);
            });
        }
    }
    renderImagePaste(basePath, imageFilePath) {
        if (basePath) {
            imageFilePath = path.relative(basePath, imageFilePath);
            if (process.platform === 'win32') {
                imageFilePath = imageFilePath.replace(/\\/g, '/');
            }
        }
        const ext = path.extname(imageFilePath);
        const imageFilePathWithoutExt = imageFilePath.replace(/\.\w+$/, '');
        const fileName = path.basename(imageFilePath);
        const fileNameWithoutExt = path.basename(imageFilePath, ext);
        let result = this.pasteTemplate;
        result = result.replace(this.PATH_VARIABLE_IMAGE_FILE_PATH, imageFilePath);
        result = result.replace(this.PATH_VARIABLE_IMAGE_FILE_PATH_WITHOUT_EXT, imageFilePathWithoutExt);
        result = result.replace(this.PATH_VARIABLE_IMAGE_FILE_NAME, fileName);
        result = result.replace(this.PATH_VARIABLE_IMAGE_FILE_NAME_WITHOUT_EXT, fileNameWithoutExt);
        return result;
    }
    replacePathVariables(pathStr, _projectRoot, curFilePath, postFunction = x => x) {
        const currentFileDir = path.dirname(curFilePath);
        let graphicsPath = this.extension.workshop.getGraphicsPath();
        graphicsPath = graphicsPath.length !== 0 ? graphicsPath[0] : this.graphicsPathFallback;
        graphicsPath = path.resolve(currentFileDir, graphicsPath);
        pathStr = pathStr.replace(this.PATH_VARIABLE_GRAPHICS_PATH, postFunction(graphicsPath));
        pathStr = pathStr.replace(this.PATH_VARIABLE_CURRNET_FILE_DIR, postFunction(currentFileDir));
        return pathStr;
    }
}
exports.Paster = Paster;
//# sourceMappingURL=paster.js.map