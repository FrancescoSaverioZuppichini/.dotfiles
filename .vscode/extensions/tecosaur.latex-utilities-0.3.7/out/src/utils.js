"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const child_process_1 = require("child_process");
/**
 * Remove the comments if any
 */
function stripComments(text, commentSign) {
    const pattern = '([^\\\\]|^)' + commentSign + '.*$';
    const reg = RegExp(pattern, 'gm');
    return text.replace(reg, '$1');
}
exports.stripComments = stripComments;
/**
 * @param id document languageId
 */
function hasTexId(id) {
    return id === 'tex' || id === 'latex' || id === 'doctex';
}
exports.hasTexId = hasTexId;
function checkCommandExists(command) {
    try {
        child_process_1.execSync(`${command} --version`);
    }
    catch (error) {
        if (error.status === 127) {
            vscode.window.showErrorMessage(`Command ${command} not found`);
        }
    }
}
exports.checkCommandExists = checkCommandExists;
//# sourceMappingURL=utils.js.map