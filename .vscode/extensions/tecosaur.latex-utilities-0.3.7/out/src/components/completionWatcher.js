"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const typeFinder_1 = require("./typeFinder");
const child_process_1 = require("child_process");
const path = require("path");
const fs_1 = require("fs");
const fs_extra_1 = require("fs-extra");
const DEBUG_CONSOLE_LOG = false;
let debuglog;
if (DEBUG_CONSOLE_LOG) {
    debuglog = function (icon, start, action) {
        console.log(`${icon} Watcher took ${+new Date() - start}ms ${action}`);
    };
}
else {
    debuglog = (_i, _s, _a) => { };
}
class CompletionWatcher {
    constructor(extension) {
        this.currentlyExecutingChange = false;
        this.MAX_CONFIG_AGE = 5000;
        this.snippets = [];
        this.activeSnippets = [];
        this.extension = extension;
        this.typeFinder = new typeFinder_1.TypeFinder();
        this.enabled = vscode.workspace.getConfiguration('latex-utilities').get('liveReformat.enabled');
        this.configAge = +new Date();
        vscode.workspace.onDidChangeTextDocument(this.watcher, this);
        this.snippetFile = {
            user: this.getUserSnippetsFile(),
            extension: path.join(this.extension.extensionRoot, 'resources', 'liveSnippets.json')
        };
        this.loadSnippets();
        extension.logger.addLogMessage('Completion Watcher Initialised');
    }
    processSnippets() {
        for (let i = 0; i < this.snippets.length; i++) {
            const snippet = this.snippets[i];
            if (!/\$\$(?:\d|{\d)/.test(snippet.body) && snippet.noPlaceholders === undefined) {
                snippet.noPlaceholders = true;
                if (snippet.priority === undefined) {
                    snippet.priority = -0.1;
                }
            }
            if (snippet.priority === undefined) {
                snippet.priority = 0;
            }
            if (snippet.triggerWhenComplete === undefined) {
                snippet.triggerWhenComplete = false;
            }
            if (snippet.mode === undefined) {
                snippet.mode = 'any';
            }
            else if (!/^maths|text|any$/.test(snippet.mode)) {
                this.extension.logger.addLogMessage(`Invalid mode (${snippet.mode}) for live snippet "${snippet.description}"`);
            }
        }
        this.snippets.sort((a, b) => {
            return (b.priority === undefined ? 0 : b.priority) - (a.priority === undefined ? 0 : a.priority);
        });
    }
    async watcher(e) {
        if (+new Date() - this.configAge > this.MAX_CONFIG_AGE) {
            this.enabled = vscode.workspace.getConfiguration('latex-utilities').get('liveReformat.enabled');
            this.configAge = +new Date();
        }
        if (e.document.languageId !== 'latex' ||
            e.contentChanges.length === 0 ||
            this.currentlyExecutingChange ||
            this.sameChanges(e) ||
            !this.enabled ||
            !vscode.window.activeTextEditor) {
            return;
        }
        this.lastChanges = e;
        this.activeSnippets = [];
        const start = +new Date();
        let columnOffset = 0;
        for (const change of e.contentChanges) {
            const type = this.typeFinder.getTypeAtPosition(e.document, change.range.start, this.lastKnownType);
            this.lastKnownType = { position: change.range.start, mode: type };
            if (change.range.isSingleLine) {
                let line = e.document.lineAt(change.range.start.line);
                for (let i = 0; i < this.snippets.length; i++) {
                    if (this.snippets[i].mode === 'any' || this.snippets[i].mode === type) {
                        const newColumnOffset = await this.execSnippet(this.snippets[i], line, change, columnOffset);
                        if (newColumnOffset === 'break') {
                            break;
                        }
                        else if (newColumnOffset !== undefined) {
                            columnOffset += newColumnOffset;
                            line = e.document.lineAt(change.range.start.line);
                        }
                    }
                }
            }
        }
        this.extension.telemetryReporter.sendTelemetryEvent('liveSnippetTimings', {
            timeToCheck: (start - +new Date()).toString()
        });
        debuglog('🔵', start, 'to check for snippets');
    }
    sameChanges(changes) {
        if (!this.lastChanges) {
            return false;
        }
        else if (this.lastChanges.contentChanges.length !== changes.contentChanges.length) {
            return false;
        }
        else {
            const changeSame = this.lastChanges.contentChanges.every((value, index) => {
                const newChange = changes.contentChanges[index];
                if (value.text !== newChange.text || !value.range.isEqual(newChange.range)) {
                    return false;
                }
                return true;
            });
            if (!changeSame) {
                return false;
            }
        }
        return true;
    }
    async execSnippet(snippet, line, change, columnOffset) {
        return new Promise((resolve, reject) => {
            const match = snippet.prefix.exec(line.text.substr(0, change.range.start.character + change.text.length + columnOffset));
            if (match && vscode.window.activeTextEditor) {
                if (this.snippetFile.current === this.snippetFile.user) {
                    this.extension.telemetryReporter.sendTelemetryEvent('livesnippet', {
                        description: 'CUSTOM_SNIPPET'
                    });
                }
                else if (snippet.description) {
                    this.extension.telemetryReporter.sendTelemetryEvent('livesnippet', {
                        description: snippet.description
                    });
                }
                let matchRange;
                let replacement;
                if (snippet.body === 'SPECIAL_ACTION_BREAK') {
                    resolve('break');
                    return;
                }
                else if (snippet.body === 'SPECIAL_ACTION_FRACTION') {
                    [matchRange, replacement] = this.getFraction(match, line);
                }
                else {
                    matchRange = new vscode.Range(new vscode.Position(line.lineNumber, match.index), new vscode.Position(line.lineNumber, match.index + match[0].length));
                    if (snippet.body === 'SPECIAL_ACTION_SYMPY') {
                        replacement = this.execSympy(match, line);
                    }
                    else {
                        replacement = match[0].replace(snippet.prefix, snippet.body).replace(/\$\$/g, '$');
                    }
                }
                if (snippet.triggerWhenComplete) {
                    this.currentlyExecutingChange = true;
                    const changeStart = +new Date();
                    if (snippet.noPlaceholders) {
                        vscode.window.activeTextEditor
                            .edit(editBuilder => {
                            editBuilder.replace(matchRange, replacement);
                        }, { undoStopBefore: true, undoStopAfter: true })
                            .then(() => {
                            const offset = replacement.length - match[0].length;
                            if (vscode.window.activeTextEditor && offset > 0) {
                                vscode.window.activeTextEditor.selection = new vscode.Selection(vscode.window.activeTextEditor.selection.anchor.translate(0, offset), vscode.window.activeTextEditor.selection.anchor.translate(0, offset));
                            }
                            this.currentlyExecutingChange = false;
                            debuglog(' ▹', changeStart, 'to perform text replacement');
                            resolve(offset);
                        });
                    }
                    else {
                        vscode.window.activeTextEditor
                            .edit(editBuilder => {
                            editBuilder.delete(matchRange);
                        }, { undoStopBefore: true, undoStopAfter: false })
                            .then(() => {
                            if (!vscode.window.activeTextEditor) {
                                return;
                            }
                            vscode.window.activeTextEditor
                                .insertSnippet(new vscode.SnippetString(replacement), undefined, {
                                undoStopBefore: true,
                                undoStopAfter: true
                            })
                                .then(() => {
                                this.currentlyExecutingChange = false;
                                debuglog(' ▹', changeStart, 'to insert snippet');
                                resolve(replacement.length - match[0].length);
                            }, (reason) => {
                                this.currentlyExecutingChange = false;
                                reject(reason);
                            });
                        }, (reason) => {
                            this.currentlyExecutingChange = false;
                            reject(reason);
                        });
                    }
                }
                else {
                    this.activeSnippets.push({
                        label: replacement,
                        filterText: match[0],
                        sortText: match[0],
                        range: matchRange,
                        detail: 'live snippet',
                        kind: vscode.CompletionItemKind.Reference
                    });
                }
            }
            else {
                resolve(undefined);
            }
        });
    }
    provide() {
        return this.activeSnippets;
    }
    editSnippetsFile() {
        if (!fs_1.existsSync(this.snippetFile.user)) {
            fs_1.writeFileSync(this.snippetFile.user, fs_1.readFileSync(this.snippetFile.extension), 'utf8');
        }
        vscode.workspace
            .openTextDocument(vscode.Uri.file(this.snippetFile.user))
            .then(doc => vscode.window.showTextDocument(doc));
    }
    resetSnippetsFile() {
        // retire any current user snippets file
        if (fs_1.existsSync(this.snippetFile.user)) {
            const shiftedFile = this.snippetFile.user.replace(/\.json$/, '.old.json');
            if (fs_1.existsSync(shiftedFile)) {
                fs_extra_1.removeSync(shiftedFile);
            }
            fs_1.renameSync(this.snippetFile.user, shiftedFile);
        }
        this.snippetFile.current = this.snippetFile.extension;
        this.extension.telemetryReporter.sendTelemetryEvent('livesnippet_reset');
    }
    compareSnippetsFile() {
        this.extension.telemetryReporter.sendTelemetryEvent('livesnippet_compare');
        return vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(this.snippetFile.extension), vscode.Uri.file(this.snippetFile.user), 'LiveSnippets: Default 🠚 User');
    }
    determineIfUserSnippetsRedundant() {
        const userSnippetsText = fs_1.readFileSync(this.snippetFile.user).toString();
        const extSnippetsText = fs_1.readFileSync(this.snippetFile.extension).toString();
        if (userSnippetsText === extSnippetsText) {
            vscode.window
                .showWarningMessage("You don't seem to have changed the default snippets, but having a user config prevents you from receiving updates to the default", 'Keep using the extension snippet file', 'Switch to user snippet file')
                .then(option => {
                if (option === 'Keep using the extension snippet file') {
                    vscode.commands.executeCommand('latex-utilities.resetLiveSnippetsFile');
                }
            });
        }
    }
    loadSnippets(force = false) {
        let snippetsFile;
        if (fs_1.existsSync(this.snippetFile.user)) {
            snippetsFile = this.snippetFile.user;
        }
        else {
            snippetsFile = this.snippetFile.extension;
        }
        if (snippetsFile === this.snippetFile.current && !force) {
            return;
        }
        else {
            this.snippetFile.current = snippetsFile;
            const snippets = JSON.parse(fs_1.readFileSync(this.snippetFile.current, { encoding: 'utf8' }));
            for (let i = 0; i < snippets.length; i++) {
                snippets[i].prefix = new RegExp(snippets[i].prefix);
            }
            this.snippets = snippets;
            this.processSnippets();
        }
        this.extension.logger.addLogMessage('Live Snippets Loaded');
    }
    getUserSnippetsFile() {
        const codeFolder = vscode.version.indexOf('insider') >= 0 ? 'Code - Insiders' : 'Code';
        const templateName = 'latexUtilsLiveSnippets.json';
        if (process.platform === 'win32' && process.env.APPDATA) {
            return path.join(process.env.APPDATA, codeFolder, 'User', templateName);
        }
        else if (process.platform === 'darwin' && process.env.HOME) {
            return path.join(process.env.HOME, 'Library', 'Application Support', codeFolder, 'User', templateName);
        }
        else if (process.platform === 'linux' && process.env.HOME) {
            let conf = path.join(process.env.HOME, '.config', codeFolder, 'User', templateName);
            if (fs_1.existsSync(conf)) {
                return conf;
            }
            else {
                conf = path.join(process.env.HOME, '.config', 'Code - OSS', 'User', templateName);
                return conf;
            }
        }
        else {
            return '';
        }
    }
    getFraction(match, line) {
        const closingBracket = match[1];
        const openingBracket = { ')': '(', ']': '[', '}': '{' }[closingBracket];
        let depth = 0;
        for (let i = match.index; i >= 0; i--) {
            if (line.text[i] === closingBracket) {
                depth--;
            }
            else if (line.text[i] === openingBracket) {
                depth++;
            }
            if (depth === 0) {
                // if command keep going till the \
                const commandMatch = /.*(\\\w+)$/.exec(line.text.substr(0, i));
                if (closingBracket === '}') {
                    if (commandMatch !== null) {
                        i -= commandMatch[1].length;
                    }
                }
                const matchRange = new vscode.Range(new vscode.Position(line.lineNumber, i), new vscode.Position(line.lineNumber, match.index + match[0].length));
                const replacement = `\\frac{${commandMatch ? '\\' : ''}${line.text.substring(i + 1, match.index)}}{$1} `;
                return [matchRange, replacement];
            }
        }
        return [
            new vscode.Range(new vscode.Position(line.lineNumber, match.index + match[0].length), new vscode.Position(line.lineNumber, match.index + match[0].length)),
            ''
        ];
    }
    execSympy(match, line) {
        const replacement = 'SYMPY_CALCULATING';
        const command = match[1]
            .replace(/\\(\w+) ?/g, '$1')
            .replace(/\^/, '**')
            .replace('{', '(')
            .replace('}', ')');
        child_process_1.exec(`python3 -c "from sympy import *
import re
a, b, c, x, y, z, t = symbols('a b c x y z t')
k, m, n = symbols('k m n', integer=True)
f, g, h = symbols('f g h', cls=Function)
init_printing()
print(eval('''latex(${command})'''), end='')"`, { encoding: 'utf8' }, (_error, stdout, stderr) => {
            if (!vscode.window.activeTextEditor) {
                return;
            }
            else if (stderr) {
                stdout = 'SYMPY_ERROR';
                setTimeout(() => {
                    this.extension.logger.addLogMessage(`error executing sympy command: ${command}`);
                    if (!vscode.window.activeTextEditor) {
                        return;
                    }
                    vscode.window.activeTextEditor.edit(editBuilder => {
                        editBuilder.delete(new vscode.Range(new vscode.Position(line.lineNumber, match.index), new vscode.Position(line.lineNumber, match.index + stdout.length)));
                    });
                }, 400);
            }
            vscode.window.activeTextEditor.edit(editBuilder => {
                editBuilder.replace(new vscode.Range(new vscode.Position(line.lineNumber, match.index), new vscode.Position(line.lineNumber, match.index + replacement.length)), stdout);
            });
        });
        return replacement;
    }
}
exports.CompletionWatcher = CompletionWatcher;
class Completer {
    constructor(extension) {
        this.extension = extension;
    }
    provideCompletionItems(_document, _position, _token, _context) {
        return this.extension.completionWatcher.activeSnippets;
    }
}
exports.Completer = Completer;
//# sourceMappingURL=completionWatcher.js.map