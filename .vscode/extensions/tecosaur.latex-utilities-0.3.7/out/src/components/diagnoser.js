"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const child_process_1 = require("child_process");
const fs = require("fs");
const fse = require("fs-extra");
const path = require("path");
const os_1 = require("os");
const utils_1 = require("../utils");
const vale_1 = require("./linters/vale");
const languagetool_1 = require("./linters/languagetool");
class Diagnoser {
    constructor(extension) {
        this.diagnosticSources = { vale: vale_1.vale, LanguageTool: languagetool_1.LanguageTool };
        this.TEMPFOLDER_NAME = 'vscode-latexworkshop';
        this.tempfile = '';
        this.initalised = false;
        this.changes = [];
        this.extension = extension;
        // not calling updateConfig() because that doesn't make tslint happy
        const linterConfig = vscode.workspace.getConfiguration('latex-utilities.linter');
        this.enabledLinters = linterConfig.get('providers');
        this.lintersArgs = linterConfig.get('arguments');
    }
    updateConfig() {
        const linterConfig = vscode.workspace.getConfiguration('latex-utilities.linter');
        this.enabledLinters = linterConfig.get('providers');
        this.lintersArgs = linterConfig.get('arguments');
    }
    async lintDocument(document) {
        // separate because typescript was annoying when this logic was in the main function
        if (document === undefined) {
            if (vscode.window.activeTextEditor) {
                document = vscode.window.activeTextEditor.document;
            }
            else {
                return new Error('No active document to lint');
            }
        }
        return this.lintTheDocument(document);
    }
    async lintTheDocument(document) {
        if (!this.initalised) {
            await this.cleanupTempDir();
            if (!fs.existsSync(path.join(os_1.tmpdir(), this.TEMPFOLDER_NAME))) {
                await fs.mkdirSync(path.join(os_1.tmpdir(), this.TEMPFOLDER_NAME));
            }
            this.initalised = true;
        }
        this.changes = [];
        this.latexToPlaintext(document);
        for (const linterName of this.enabledLinters) {
            console.log(linterName);
            const linter = this.diagnosticSources[linterName];
            const extraArgs = linterName in this.lintersArgs ? this.lintersArgs[linterName] : [];
            const command = linter.command(this.tempfile, extraArgs);
            if (linter.currentProcess === undefined) {
                this.extension.logger.addLogMessage(`Running ${linterName} on ${document.fileName}`);
            }
            else {
                this.extension.logger.addLogMessage(`Refusing to run ${linterName} on ${document.fileName} as this process is already running`);
                return;
            }
            linter.currentProcess = child_process_1.spawn(command[0], command.slice(1));
            let output = '';
            linter.currentProcess.stdout.on('data', data => {
                output += data;
            });
            linter.currentProcess.stdout.on('close', (exitCode, _signal) => {
                this.extension.logger.addLogMessage(`Running ${linterName} on ${document.fileName} finished with exit code ${exitCode}`);
                if (linter.currentProcess !== undefined) {
                    linter.currentProcess.kill();
                }
                linter.currentProcess = undefined;
                linter.parser(document, this.tempfile, output, this.changes);
            });
            linter.currentProcess.stdout.on('exit', (exitCode, _signal) => {
                this.extension.logger.addLogMessage(`Running ${linterName} on ${document.fileName} exited with exit code ${exitCode}`);
            });
        }
        this.updateConfig();
    }
    latexToPlaintext(document) {
        let str = document.getText();
        /**
         * command: transparencyLevel, with
         * 0 - none
         * 1 - mandatory only
         * 2 - optional only
         * 3 - both
         */
        const transparentCommands = {
            emph: 1,
            textit: 1,
            textbf: 1,
            textsl: 1,
            textsc: 1,
            part: 1,
            chapter: 1,
            section: 1,
            subsection: 1,
            subsubsection: 1,
            paragraph: 1,
            subparagraph: 1,
            acr: 1
        };
        const opaqueEnvs = ['align', 'equation', 'figure', 'theorem', 'minted', 'figure', 'table', 'tabular'];
        const transparentEnvArguments = {};
        const replacements = [];
        const queueReplacement = (start, end, replacement) => {
            replacements.push([start, end, replacement]);
            this.changes.push([
                new vscode.Range(document.positionAt(start), document.positionAt(end)),
                replacement.length
            ]);
        };
        const replaceCommand = (command, args) => {
            let transparencyLevel = 0;
            if (transparentCommands.hasOwnProperty(command.text.replace(/\*$/, ''))) {
                transparencyLevel = transparentCommands[command.text.replace(/\*$/, '')];
            }
            queueReplacement(command.start - 1, command.start +
                command.text.length +
                (args.length === 1 && [' ', '\n'].includes(str[command.start + command.text.length]) ? 1 : 0), transparencyLevel === 0 ? 'X' : '');
            replaceArgs(args, transparencyLevel);
        };
        const replaceArgs = (args, transparencyLevel) => {
            if (args.length === 0) {
                return;
            }
            args.forEach(arg => {
                if (str[arg.start] === '{' && [1, 3].includes(transparencyLevel)) {
                    // mandatory arg, and supposed to be passed through
                    queueReplacement(arg.start, arg.end, str.substring(arg.start + 1, arg.end - 1));
                }
                else if (str[arg.start] === '[' && [2, 3].includes(transparencyLevel)) {
                    // optional arg, and supposed to be passed through
                    queueReplacement(arg.start, arg.end, str.substring(arg.start + 1, arg.end - 1));
                }
                else {
                    queueReplacement(arg.start, arg.end, '');
                }
            });
            ignoreUntil = Math.max(ignoreUntil, args[args.length - 1].end);
        };
        const processEnv = (regexMatch, args) => {
            const env = str.substring(args[0].start + 1, args[0].end - 1);
            const envCloseCommand = `\\end{${env}}`;
            const envClose = str.indexOf(envCloseCommand);
            queueReplacement(regexMatch.index + regexMatch[0].indexOf(regexMatch[1]) - 1, args[0].end, ''); // remove \begin{env}
            const transparencyLevel = transparentEnvArguments.hasOwnProperty(env.replace(/\*$/, ''))
                ? transparentEnvArguments[env.replace(/\*$/, '')]
                : 0;
            replaceArgs(args.slice(1), transparencyLevel);
            if (opaqueEnvs.includes(env.replace(/\*$/, ''))) {
                queueReplacement(args[args.length - 1].end, envClose + envCloseCommand.length, '');
                ignoreUntil = Math.max(ignoreUntil, envClose + envCloseCommand.length);
            }
        };
        const regexReplacements = [
            [/.*[^\\]\\begin{document}/gs, ''],
            [/(^|[^\\])\\end{document}.*/gs, '$1']
        ];
        for (let i = 0; i < regexReplacements.length; i++) {
            let match;
            while ((match = regexReplacements[i][0].exec(document.getText()))) {
                this.changes.push([
                    new vscode.Range(document.positionAt(match.index), document.positionAt(regexReplacements[i][0].lastIndex - 1)),
                    1
                ]);
            }
            str = str.replace(regexReplacements[i][0], regexReplacements[i][1]);
        }
        const commandRegex = /\\([\(\)\[\]]|[\w@]+\*?)/gs;
        let ignoreUntil = 0;
        let result;
        while ((result = commandRegex.exec(str)) !== null) {
            if (result.index < ignoreUntil || (result.index > 0 && str[result.index - 1] === '\\')) {
                continue;
            }
            const command = result[1];
            if (command === '(') {
                const close = str.indexOf('\\)', result.index + 1) + 2;
                queueReplacement(result.index + result[0].indexOf(command), close, '');
                ignoreUntil = Math.max(ignoreUntil, close);
                continue;
            }
            else if (command === '[') {
                const close = str.indexOf('\\]', result.index + 1) + 2;
                queueReplacement(result.index + result[0].indexOf(command), close, '');
                ignoreUntil = Math.max(ignoreUntil, close);
                continue;
            }
            let args = [];
            let argumentTest = result.index + result[0].length;
            let nextChar = str[argumentTest];
            let argumentEnd;
            while (['{', '['].includes(nextChar)) {
                argumentEnd = utils_1.getClosingBracket(str, argumentTest);
                args.push({ start: argumentTest, end: argumentEnd + 1 });
                argumentTest = argumentEnd + 1;
                if (str[argumentTest] === '\n') {
                    argumentTest++;
                }
                nextChar = str[argumentTest];
            }
            if (command === 'begin') {
                processEnv(result, args);
                continue;
            }
            replaceCommand({ text: command, start: result.index + result[0].indexOf(command) }, args);
        }
        let removedSoFar = 0;
        replacements.forEach(rep => {
            str = str.substr(0, rep[0] - removedSoFar) + rep[2] + str.substr(rep[1] - removedSoFar);
            removedSoFar += rep[1] - rep[0] - rep[2].length;
        });
        // Save temporary file
        this.tempfile = path.join(os_1.tmpdir(), this.TEMPFOLDER_NAME, `diagnoser-${path.basename(document.uri.fsPath)}`);
        fs.writeFileSync(this.tempfile, str);
        console.log(this.tempfile);
    }
    // private translatePlaintextPosition(linter: IDiagnosticSource) {
    //     linter.actions.forEach(
    //         (value : vscode.CodeAction, key: vscode.Range) => {
    //             console.log(key,value)
    //             for (let key_offset in this.offsets){
    //                 let value = this.offsets[key_offset]
    //             }
    //         }
    //     );
    // }
    async cleanupTempDir() {
        await fse.removeSync(path.join(os_1.tmpdir(), this.TEMPFOLDER_NAME));
    }
}
exports.Diagnoser = Diagnoser;
//# sourceMappingURL=diagnoser.js.map