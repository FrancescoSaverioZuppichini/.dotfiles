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
exports.PathUtils = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const cs = __importStar(require("cross-spawn"));
const fs = __importStar(require("fs-extra"));
const utils = __importStar(require("../../utils/utils"));
class PathUtils {
    constructor(extension) {
        this.extension = extension;
    }
    get rootDir() {
        return this.extension.manager.rootDir;
    }
    getOutDir(texFile) {
        return this.extension.manager.getOutDir(texFile);
    }
    parseInputFilePath(regResult, currentFile, rootFile) {
        const texDirs = vscode.workspace.getConfiguration('latex-workshop').get('latex.texDirs');
        if (regResult[0].startsWith('\\subimport') || regResult[0].startsWith('\\subinputfrom') || regResult[0].startsWith('\\subincludefrom')) {
            return utils.resolveFile([path.dirname(currentFile)], path.join(regResult[1], regResult[2]));
        }
        else if (regResult[0].startsWith('\\import') || regResult[0].startsWith('\\inputfrom') || regResult[0].startsWith('\\includefrom')) {
            return utils.resolveFile([regResult[1], path.join(path.dirname(rootFile), regResult[1])], regResult[2]);
        }
        else {
            return utils.resolveFile([path.dirname(currentFile), path.dirname(rootFile), ...texDirs], regResult[2]);
        }
    }
    /**
     * Search for a `.fls` file associated to a tex file
     * @param texFile The path of LaTeX file
     * @return The path of the .fls file or undefined
     */
    getFlsFilePath(texFile) {
        const rootDir = path.dirname(texFile);
        const outDir = this.getOutDir(texFile);
        const baseName = path.parse(texFile).name;
        const flsFile = path.resolve(rootDir, path.join(outDir, baseName + '.fls'));
        if (!fs.existsSync(flsFile)) {
            this.extension.logger.addLogMessage(`Cannot find fls file: ${flsFile}`);
            return undefined;
        }
        this.extension.logger.addLogMessage(`Fls file found: ${flsFile}`);
        return flsFile;
    }
    parseFlsContent(content, rootDir) {
        const inputFiles = new Set();
        const outputFiles = new Set();
        const regex = /^(?:(INPUT)\s*(.*))|(?:(OUTPUT)\s*(.*))$/gm;
        // regex groups
        // #1: an INPUT entry --> #2 input file path
        // #3: an OUTPUT entry --> #4: output file path
        while (true) {
            const result = regex.exec(content);
            if (!result) {
                break;
            }
            if (result[1]) {
                const inputFilePath = path.resolve(rootDir, result[2]);
                if (inputFilePath) {
                    inputFiles.add(inputFilePath);
                }
            }
            else if (result[3]) {
                const outputFilePath = path.resolve(rootDir, result[4]);
                if (outputFilePath) {
                    outputFiles.add(outputFilePath);
                }
            }
        }
        return { input: Array.from(inputFiles), output: Array.from(outputFiles) };
    }
    kpsewhichBibPath(bib) {
        const kpsewhich = vscode.workspace.getConfiguration('latex-workshop').get('kpsewhich.path');
        this.extension.logger.addLogMessage(`Calling ${kpsewhich} to resolve file: ${bib}`);
        try {
            const kpsewhichReturn = cs.sync(kpsewhich, ['-format=.bib', bib]);
            if (kpsewhichReturn.status === 0) {
                const bibPath = kpsewhichReturn.stdout.toString().replace(/\r?\n/, '');
                if (bibPath === '') {
                    return undefined;
                }
                else {
                    this.extension.logger.addLogMessage(`Found .bib file using kpsewhich: ${bibPath}`);
                    return bibPath;
                }
            }
        }
        catch (e) {
            this.extension.logger.addLogMessage(`Cannot run kpsewhich to resolve .bib file: ${bib}`);
        }
        return undefined;
    }
    resolveBibPath(bib, baseDir) {
        const configuration = vscode.workspace.getConfiguration('latex-workshop');
        const bibDirs = configuration.get('latex.bibDirs');
        let searchDirs;
        if (this.rootDir) {
            // chapterbib requires to load the .bib file in every chapter using
            // the path relative to the rootDir
            searchDirs = [this.rootDir, baseDir, ...bibDirs];
        }
        else {
            searchDirs = [baseDir, ...bibDirs];
        }
        const bibPath = utils.resolveFile(searchDirs, bib, '.bib');
        if (!bibPath) {
            this.extension.logger.addLogMessage(`Cannot find .bib file: ${bib}`);
            if (configuration.get('kpsewhich.enabled')) {
                return this.kpsewhichBibPath(bib);
            }
            else {
                return undefined;
            }
        }
        this.extension.logger.addLogMessage(`Found .bib file: ${bibPath}`);
        return bibPath;
    }
}
exports.PathUtils = PathUtils;
//# sourceMappingURL=pathutils.js.map