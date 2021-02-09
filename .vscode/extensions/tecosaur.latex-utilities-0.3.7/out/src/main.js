"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const logger_1 = require("./components/logger");
const completionWatcher_1 = require("./components/completionWatcher");
const paster_1 = require("./components/paster");
const wordCounter_1 = require("./components/wordCounter");
const tikzcodelense_1 = require("./providers/tikzcodelense");
const macroDefinitions_1 = require("./providers/macroDefinitions");
const tikzpreview_1 = require("./components/tikzpreview");
const zotero_1 = require("./components/zotero");
const utils = require("./utils");
const vscode_extension_telemetry_1 = require("vscode-extension-telemetry");
let extension;
function activate(context) {
    extension = new Extension();
    extension.logger.addLogMessage('LaTeX Utilities Started');
    context.subscriptions.push(vscode.commands.registerCommand('latex-utilities.editLiveSnippetsFile', () => extension.completionWatcher.editSnippetsFile()), vscode.commands.registerCommand('latex-utilities.resetLiveSnippetsFile', () => extension.completionWatcher.resetSnippetsFile()), vscode.commands.registerCommand('latex-utilities.compareLiveSnippetsFile', () => extension.completionWatcher.compareSnippetsFile()), vscode.commands.registerCommand('latex-utilities.formattedPaste', () => extension.paster.paste()), vscode.commands.registerCommand('latex-utilities.countWord', () => extension.wordCounter.count()), vscode.commands.registerCommand('latex-utilities.viewtikzpicture', (document, range) => extension.tikzPreview.view(document, range)), vscode.commands.registerCommand('latex-utilities.citeZotero', () => extension.zotero.cite()), vscode.commands.registerCommand('latex-utilities.openInZotero', () => extension.zotero.openCitation()), vscode.commands.registerCommand('latex-utilities.selectWordcountFormat', () => extension.wordCounter.pickFormat()));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
        if (utils.hasTexId(e.document.languageId)) {
            extension.completionWatcher.watcher(e);
            extension.tikzPreview.onFileChange(e.document, e.contentChanges);
        }
    }, undefined, [new vscode.Disposable(extension.tikzPreview.cleanupTempFiles)]), vscode.workspace.onDidSaveTextDocument((e) => {
        if (e.uri.fsPath === extension.completionWatcher.snippetFile.user) {
            extension.completionWatcher.loadSnippets(true);
        }
        else {
            extension.wordCounter.setStatus();
        }
    }), vscode.workspace.onDidCloseTextDocument((e) => {
        if (e.uri.fsPath.includes(extension.completionWatcher.snippetFile.user)) {
            extension.completionWatcher.determineIfUserSnippetsRedundant();
        }
    }), vscode.window.onDidChangeActiveTextEditor((_e) => {
        extension.wordCounter.setStatus();
    }));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'tex' }, extension.completer), vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'latex' }, extension.completer), vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'doctex' }, extension.completer), vscode.languages.registerCodeLensProvider({ language: 'latex', scheme: 'file' }, new tikzcodelense_1.TikzCodeLense()), vscode.languages.registerDefinitionProvider({ language: 'latex', scheme: 'file' }, new macroDefinitions_1.MacroDefinitions(extension)));
    newVersionMessage(context.extensionPath);
    context.subscriptions.push(extension.telemetryReporter);
}
exports.activate = activate;
function deactivate() {
    extension.tikzPreview.cleanupTempFiles();
    extension.telemetryReporter.dispose();
}
exports.deactivate = deactivate;
function newVersionMessage(extensionPath) {
    fs.readFile(`${extensionPath}${path.sep}package.json`, (err, data) => {
        if (err) {
            extension.logger.addLogMessage('Cannot read package information.');
            return;
        }
        extension.packageInfo = JSON.parse(data.toString());
        extension.logger.addLogMessage(`LaTeX Utilities version: ${extension.packageInfo.version}`);
        if (fs.existsSync(`${extensionPath}${path.sep}VERSION`) &&
            fs.readFileSync(`${extensionPath}${path.sep}VERSION`).toString() === extension.packageInfo.version) {
            return;
        }
        fs.writeFileSync(`${extensionPath}${path.sep}VERSION`, extension.packageInfo.version);
        const configuration = vscode.workspace.getConfiguration('latex-utilities');
        // todo: remove me after next update
        if (fs.existsSync(extension.completionWatcher.snippetFile.user)) {
            vscode.window
                .showWarningMessage('LaTeX Utilities default LiveSnippets default has changed significantly', 'Reset to new defaults', 'Compare my snippets to default', 'Ignore')
                .then(option => {
                switch (option) {
                    case 'Reset to new defaults':
                        vscode.commands.executeCommand('latex-utilities.resetLiveSnippetsFile');
                        break;
                    case 'Compare my snippets to default':
                        vscode.commands.executeCommand('latex-utilities.compareLiveSnippetsFile');
                        vscode.window
                            .showWarningMessage('What do you want to do?', 'Reset to new defaults (keeps copy of old)', 'Leave my snippets alone')
                            .then(opt => {
                            if (opt === 'Reset to new defaults (keeps copy of old)') {
                                vscode.commands.executeCommand('latex-utilities.resetLiveSnippetsFile');
                            }
                        });
                        break;
                    default:
                        break;
                }
            });
        }
        //
        if (!configuration.get('message.update.show')) {
            return;
        }
        vscode.window
            .showInformationMessage(`LaTeX Utilities updated to version ${extension.packageInfo.version}.`, 'Change log', 'Star the project', 'Disable this message')
            .then(option => {
            switch (option) {
                case 'Change log':
                    vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(`${extensionPath}${path.sep}CHANGELOG.md`));
                    break;
                case 'Star the project':
                    vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://github.com/tecosaur/LaTeX-Utilities/'));
                    break;
                case 'Disable this message':
                    configuration.update('message.update.show', false, true);
                    break;
                default:
                    break;
            }
        });
    });
}
class Extension {
    constructor() {
        this.extensionRoot = path.resolve(`${__dirname}/../../`);
        const self = vscode.extensions.getExtension('tecosaur.latex-utilities');
        this.telemetryReporter = new vscode_extension_telemetry_1.default('tecosaur.latex-utilities', self.packageJSON.version, '015dde22-1297-4bc0-8f8d-6587f3c192ec');
        const workshop = vscode.extensions.getExtension('james-yu.latex-workshop');
        this.workshop = workshop.exports;
        if (workshop.isActive === false) {
            workshop.activate().then(() => (this.workshop = workshop.exports));
        }
        this.logger = new logger_1.Logger(this);
        this.completionWatcher = new completionWatcher_1.CompletionWatcher(this);
        this.completer = new completionWatcher_1.Completer(this);
        this.paster = new paster_1.Paster(this);
        this.wordCounter = new wordCounter_1.WordCounter(this);
        this.tikzPreview = new tikzpreview_1.TikzPictureView(this);
        this.zotero = new zotero_1.Zotero(this);
    }
}
exports.Extension = Extension;
//# sourceMappingURL=main.js.map