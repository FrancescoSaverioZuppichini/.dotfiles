"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const utils_1 = require("../utils");
const child_process_1 = require("child_process");
class MacroDefinitions {
    constructor(extension) {
        this.extension = extension;
    }
    async provideDefinition(document, position, _token) {
        const enabled = vscode.workspace.getConfiguration('latex-utilities.texdef').get('enabled');
        if (!enabled) {
            return;
        }
        const line = document.lineAt(position.line);
        let command;
        const pattern = /\\[\w@]+/g;
        let match = pattern.exec(line.text);
        while (match !== null) {
            const matchStart = line.range.start.translate(0, match.index);
            const matchEnd = matchStart.translate(0, match[0].length);
            const matchRange = new vscode.Range(matchStart, matchEnd);
            if (matchRange.contains(position)) {
                command = matchRange;
                break;
            }
            match = pattern.exec(line.text);
        }
        if (command === undefined) {
            return;
        }
        utils_1.checkCommandExists('texdef');
        const texdefOptions = ['--source', '--Find', '--tex', 'latex'];
        const packages = this.extension.workshop.completer.command.usedPackages();
        if (/\.sty$/.test(document.uri.fsPath)) {
            texdefOptions.push(document.uri.fsPath.replace(/\.sty$/, ''));
        }
        texdefOptions.push(...packages.map(p => ['-p', p]).reduce((prev, next) => prev.concat(next), []));
        const documentClass = this.getDocumentClass(document);
        texdefOptions.push('--class', documentClass !== null ? documentClass : 'article');
        texdefOptions.push(document.getText(command));
        const texdefResult = await this.getFirstLineOfOutput('texdef', texdefOptions);
        const resultPattern = /% (.+), line (\d+):/;
        let result;
        if ((result = texdefResult.match(resultPattern)) !== null) {
            this.extension.telemetryReporter.sendTelemetryEvent('texdef');
            return new vscode.Location(vscode.Uri.file(result[1]), new vscode.Position(parseInt(result[2]) - 1, 0));
        }
        else {
            vscode.window.showWarningMessage(`Could not find definition for ${document.getText(command)}`);
            this.extension.logger.addLogMessage(`Could not find definition for ${document.getText(command)}`);
            return;
        }
    }
    getDocumentClass(document) {
        const documentClassPattern = /\\documentclass((?:\[[\w-,]*\])?{[\w-]+)}/;
        let documentClass;
        let line = 0;
        while (line < 50 && line < document.lineCount) {
            const lineContents = document.lineAt(line++).text;
            if ((documentClass = lineContents.match(documentClassPattern)) !== null) {
                return documentClass[1].replace(/{([\w-]+)$/, '$1');
            }
        }
        return null;
    }
    async getFirstLineOfOutput(command, options) {
        return new Promise(resolve => {
            const startTime = +new Date();
            this.extension.logger.addLogMessage(`Running command ${command} ${options.join(' ')}`);
            const cmdProcess = child_process_1.spawn(command, options);
            cmdProcess.stdout.on('data', data => {
                this.extension.logger.addLogMessage(`Took ${+new Date() - startTime}ms to find definition for ${options[options.length - 1]}`);
                cmdProcess.kill();
                resolve(data.toString());
            });
            cmdProcess.stdout.on('error', () => {
                this.extension.logger.addLogMessage(`Error running texdef for ${options[options.length - 1]}}`);
                resolve('');
            });
            cmdProcess.stdout.on('end', () => {
                resolve('');
            });
            setTimeout(() => {
                cmdProcess.kill();
            }, 6000);
        });
    }
}
exports.MacroDefinitions = MacroDefinitions;
//# sourceMappingURL=macroDefinitions.js.map