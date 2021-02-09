"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
class Logger {
    constructor(extension) {
        this.extension = extension;
        this.logPanel = vscode.window.createOutputChannel('LaTeX Utilities');
        this.addLogMessage('Initializing LaTeX Utilities.');
    }
    addLogMessage(message) {
        this.logPanel.append(`[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ${message}\n`);
    }
    showErrorMessage(message, ...args) {
        const configuration = vscode.workspace.getConfiguration('latex-utilities');
        if (configuration.get('message.error.show')) {
            return vscode.window.showErrorMessage(message, ...args);
        }
        else {
            return undefined;
        }
    }
    showLog() {
        this.logPanel.show();
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map