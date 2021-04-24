"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BibLogParser = void 0;
const vscode = __importStar(require("vscode"));
const multiLineWarning = /^Warning--(.+)\n--line (\d+) of file (.+)$/gm;
const singleLineWarning = /^Warning--(.+) in ([^\s]+)\s*$/gm;
const multiLineError = /^(.*)---line (\d+) of file (.*)\n([^]+?)\nI'm skipping whatever remains of this entry$/gm;
const badCrossReference = /^(A bad cross reference---entry ".+?"\nrefers to entry.+?, which doesn't exist)$/gm;
const multiLineCommandError = /^(.*)\n?---line (\d+) of file (.*)\n([^]+?)\nI'm skipping whatever remains of this command$/gm;
const errorAuxFile = /^(.*)---while reading file (.*)$/gm;
class BibLogParser {
    constructor(extension) {
        this.buildLog = [];
        this.compilerDiagnostics = vscode.languages.createDiagnosticCollection('BibTeX');
        this.extension = extension;
    }
    parse(log, rootFile) {
        if (rootFile === undefined) {
            rootFile = this.extension.manager.rootFile;
        }
        if (rootFile === undefined) {
            this.extension.logger.addLogMessage('How can you reach this point?');
            return;
        }
        this.buildLog = [];
        let result;
        while ((result = singleLineWarning.exec(log))) {
            const location = this.findKeyLocation(result[2]);
            if (location) {
                this.buildLog.push({ type: 'warning', file: location.file, text: result[1], line: location.line });
            }
        }
        while ((result = multiLineWarning.exec(log))) {
            const filename = this.resolveBibFile(result[3], rootFile);
            this.buildLog.push({ type: 'warning', file: filename, text: result[1], line: parseInt(result[2], 10) });
        }
        while ((result = multiLineError.exec(log))) {
            const filename = this.resolveBibFile(result[3], rootFile);
            this.buildLog.push({ type: 'error', file: filename, text: result[1], line: parseInt(result[2], 10) });
        }
        while ((result = multiLineCommandError.exec(log))) {
            const filename = this.resolveBibFile(result[3], rootFile);
            this.buildLog.push({ type: 'error', file: filename, text: result[1], line: parseInt(result[2], 10) });
        }
        while ((result = badCrossReference.exec(log))) {
            this.buildLog.push({ type: 'error', file: rootFile, text: result[1], line: 1 });
        }
        while ((result = errorAuxFile.exec(log))) {
            const filename = this.resolveAuxFile(result[2], rootFile);
            this.buildLog.push({ type: 'error', file: filename, text: result[1], line: 1 });
        }
        this.extension.logger.addLogMessage(`BibTeX log parsed with ${this.buildLog.length} messages.`);
        this.extension.compilerLogParser.showCompilerDiagnostics(this.compilerDiagnostics, this.buildLog, 'BibTeX');
    }
    resolveAuxFile(filename, rootFile) {
        filename = filename.replace(/\.aux$/, '.tex');
        if (!(rootFile in this.extension.manager.cachedContent)) {
            return filename;
        }
        const texFiles = this.extension.manager.getIncludedTeX(rootFile);
        for (const tex of texFiles) {
            if (tex.endsWith(filename)) {
                return tex;
            }
        }
        this.extension.logger.addLogMessage(`Cannot resolve file while parsing BibTeX log: ${filename}`);
        return filename;
    }
    resolveBibFile(filename, rootFile) {
        if (!(rootFile in this.extension.manager.cachedContent)) {
            return filename;
        }
        const bibFiles = this.extension.manager.getIncludedBib(rootFile);
        for (const bib of bibFiles) {
            if (bib.endsWith(filename)) {
                return bib;
            }
        }
        this.extension.logger.addLogMessage(`Cannot resolve file while parsing BibTeX log: ${filename}`);
        return filename;
    }
    findKeyLocation(key) {
        const cites = this.extension.completer.citation.getEntryDict();
        if (key in cites) {
            const file = cites[key].file;
            const line = cites[key].position.line + 1;
            return { file, line };
        }
        else {
            this.extension.logger.addLogMessage(`Cannot find key when parsing BibTeX log: ${key}`);
            return undefined;
        }
    }
}
exports.BibLogParser = BibLogParser;
//# sourceMappingURL=biblogparser.js.map