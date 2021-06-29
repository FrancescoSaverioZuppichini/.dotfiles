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
exports.StructureTreeView = exports.Section = exports.SectionNodeProvider = void 0;
const vscode = __importStar(require("vscode"));
const utils = __importStar(require("../utils/utils"));
const pathutils_1 = require("../components/managerlib/pathutils");
class SectionNodeProvider {
    constructor(extension) {
        this.extension = extension;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.sectionDepths = Object.create(null);
        this.root = '';
        // our data source is a set multi-rooted set of trees
        this.ds = [];
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        const configuration = vscode.workspace.getConfiguration('latex-workshop');
        this.hierarchy = configuration.get('view.outline.sections');
        this.hierarchy.forEach((section, index) => {
            section.split('|').forEach(sec => {
                this.sectionDepths[sec] = index;
            });
        });
        this.showLabels = configuration.get('view.outline.labels.enabled');
        this.showFloats = configuration.get('view.outline.floats.enabled');
        this.showNumbers = configuration.get('view.outline.numbers.enabled');
    }
    refresh() {
        if (this.extension.manager.rootFile) {
            this.ds = this.buildModel(this.extension.manager.rootFile);
            return this.ds;
        }
        else {
            return [];
        }
    }
    update() {
        this._onDidChangeTreeData.fire(undefined);
    }
    buildModel(filePath, fileStack, parentStack, parentChildren, sectionNumber, imports = true) {
        let rootStack = [];
        if (parentStack) {
            rootStack = parentStack;
        }
        let children = [];
        if (parentChildren) {
            children = parentChildren;
        }
        let newFileStack = [];
        if (fileStack) {
            newFileStack = fileStack;
        }
        newFileStack.push(filePath);
        if (!sectionNumber) {
            sectionNumber = Array(this.hierarchy.length).fill(0);
        }
        let prevSection = undefined;
        const envStack = [];
        const currentRoot = () => {
            return rootStack[rootStack.length - 1];
        };
        const noRoot = () => {
            return rootStack.length === 0;
        };
        let content = this.extension.manager.getDirtyContent(filePath);
        if (!content) {
            return children;
        }
        content = utils.stripCommentsAndVerbatim(content);
        const endPos = content.search(/\\end{document}/gm);
        if (endPos > -1) {
            content = content.substr(0, endPos);
        }
        // The first part of pattern must match this.pathUtils.inputRegex so that
        // we can use this.pathUtils.parseInputFilePath to analyse the regex match.
        let pattern = '\\\\(';
        this.hierarchy.forEach((section, index) => {
            pattern += section;
            if (index < this.hierarchy.length - 1) {
                pattern += '|';
            }
        });
        pattern += ')(\\*)?(?:\\[[^\\[\\]\\{\\}]*\\])?{(.*)}';
        const pathRegexp = new pathutils_1.PathRegExp();
        const headingReg = RegExp(pattern, 'm');
        const envNames = this.showFloats ? ['figure', 'frame', 'table'] : ['frame'];
        const envReg = RegExp(`(?:\\\\(begin|end)(?:\\[[^[\\]]*\\])?){(?:(${envNames.join('|')})\\*?)}`, 'm');
        const labelReg = /\\label{([^}]*)}/m;
        const lines = content.split('\n');
        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
            const line = lines[lineNumber];
            pathRegexp.resetLastIndex();
            let result = envReg.exec(line);
            if (result && result[1] === 'begin') {
                envStack.push({ name: result[2], start: lineNumber, end: lineNumber });
                continue;
            }
            else if (result && result[2] === envStack[envStack.length - 1].name) {
                const env = envStack.pop();
                if (!env) {
                    continue;
                }
                env.end = lineNumber;
                const caption = this.getCaptionOrTitle(lines, env);
                if (!caption) {
                    continue;
                }
                const depth = noRoot() ? 0 : currentRoot().depth + 1;
                sectionNumber = this.increment(sectionNumber, depth);
                const newEnv = new Section(this.formatSectionNumber(sectionNumber) + `${env.name.charAt(0).toUpperCase() + env.name.slice(1)}: ${caption}`, vscode.TreeItemCollapsibleState.Expanded, depth, env.start, env.end, filePath);
                if (noRoot()) {
                    children.push(newEnv);
                }
                else {
                    currentRoot().children.push(newEnv);
                }
                continue;
            }
            // inputs part
            if (imports) {
                const matchPath = pathRegexp.exec(line);
                if (matchPath) {
                    // zoom into this file
                    // resolve the path
                    const inputFilePath = pathRegexp.parseInputFilePath(matchPath, filePath, this.extension.manager.rootFile ? this.extension.manager.rootFile : filePath);
                    if (!inputFilePath) {
                        this.extension.logger.addLogMessage(`Could not resolve included file ${inputFilePath}`);
                        continue;
                    }
                    // Avoid circular inclusion
                    if (inputFilePath === filePath || newFileStack.includes(inputFilePath)) {
                        continue;
                    }
                    if (prevSection) {
                        prevSection.subfiles.push(inputFilePath);
                    }
                    this.buildModel(inputFilePath, newFileStack, rootStack, children, sectionNumber);
                    continue;
                }
            }
            // Headings part
            result = headingReg.exec(line);
            if (result) {
                // is it a section, a subsection, etc?
                const heading = result[1];
                const depth = this.sectionDepths[heading];
                const title = utils.getLongestBalancedString(result[3]);
                let sectionNumberStr = '';
                if (result[2] === undefined) {
                    sectionNumber = this.increment(sectionNumber, depth);
                    sectionNumberStr = this.formatSectionNumber(sectionNumber);
                }
                const newSection = new Section(sectionNumberStr + title, vscode.TreeItemCollapsibleState.Expanded, depth, lineNumber, lines.length - 1, filePath);
                if (prevSection) {
                    prevSection.toLine = lineNumber - 1;
                }
                prevSection = newSection;
                if (noRoot()) {
                    children.push(newSection);
                    rootStack.push(newSection);
                    continue;
                }
                // Find the proper root section
                while (!noRoot() && currentRoot().depth >= depth) {
                    rootStack.pop();
                }
                if (noRoot()) {
                    newSection.parent = undefined;
                    children.push(newSection);
                }
                else {
                    newSection.parent = currentRoot();
                    currentRoot().children.push(newSection);
                }
                rootStack.push(newSection);
            }
            // Labels part
            if (this.showLabels) {
                result = labelReg.exec(line);
                if (result) {
                    const depth = noRoot() ? 0 : currentRoot().depth + 1;
                    const newLabel = new Section(`#Label: ${result[1]}`, vscode.TreeItemCollapsibleState.None, depth, lineNumber, lineNumber, filePath);
                    if (noRoot()) {
                        children.push(newLabel);
                    }
                    else {
                        currentRoot().children.push(newLabel);
                    }
                }
            }
        }
        return children;
    }
    increment(sectionNumber, depth) {
        sectionNumber[depth] += 1;
        sectionNumber.forEach((_, index) => {
            if (index > depth) {
                sectionNumber[index] = 0;
            }
        });
        return sectionNumber;
    }
    formatSectionNumber(sectionNumber) {
        if (!this.showNumbers) {
            return '';
        }
        let str = '';
        sectionNumber.forEach((value) => {
            if (str === '' && value === 0) {
                return;
            }
            if (str !== '') {
                str += '.';
            }
            str += value.toString();
        });
        return str.replace(/(\.0)*$/, '') + ' ';
    }
    getTreeItem(element) {
        const hasChildren = element.children.length > 0;
        const treeItem = new vscode.TreeItem(element.label, hasChildren ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
        treeItem.command = {
            command: 'latex-workshop.goto-section',
            title: '',
            arguments: [element.fileName, element.lineNumber]
        };
        treeItem.tooltip = `Line ${element.lineNumber + 1} at ${element.fileName}`;
        return treeItem;
    }
    getChildren(element) {
        if (this.extension.manager.rootFile === undefined) {
            return [];
        }
        // if the root doesn't exist, we need
        // to explicitly build the model from disk
        if (!element) {
            return this.refresh();
        }
        return element.children;
    }
    getParent(element) {
        if (this.extension.manager.rootFile === undefined || !element) {
            return undefined;
        }
        return element.parent;
    }
    getCaptionOrTitle(lines, env) {
        const content = lines.slice(env.start, env.end).join('\n');
        let result = null;
        if (env.name === 'frame') {
            // Frame titles can be specified as either \begin{frame}{Frame Title}
            // or \begin{frame} \frametitle{Frame Title}
            const frametitleRegex = /\\frametitle(?:<[^<>]*>)?(?:\[[^[\]]*\])?{((?:[^{}]|(?:\{[^{}]*\})|\{[^{}]*\{[^{}]*\}[^{}]*\})+)}/gsm;
            // \begin{frame}(whitespace){Title} will set the title as long as the whitespace contains no more than 1 newline
            const beginframeRegex = /\\begin{frame}(?:<[^<>]*>?)?(?:\[[^[\]]*\]){0,2}[\t ]*(?:(?:\r\n|\r|\n)[\t ]*)?{((?:[^{}]|(?:\{[^{}]*\})|\{[^{}]*\{[^{}]*\}[^{}]*\})+)}/gsm;
            // \frametitle can override title set in \begin{frame}{<title>} so we check that first
            result = frametitleRegex.exec(content);
            if (!result) {
                result = beginframeRegex.exec(content);
            }
        }
        else {
            const captionRegex = /(?:\\caption(?:\[[^[\]]*\])?){((?:(?:[^{}])|(?:\{[^{}]*\}))+)}/gsm;
            let captionResult;
            // Take the last caption entry to deal with subfigures.
            // This works most of the time but not always. A definitive solution should use AST
            while ((captionResult = captionRegex.exec(content))) {
                result = captionResult;
            }
        }
        if (result) {
            // Remove indentation, newlines and the final '.'
            return result[1].replace(/^ */gm, ' ').replace(/\r|\n/g, '').replace(/\.$/, '');
        }
        return undefined;
    }
}
exports.SectionNodeProvider = SectionNodeProvider;
class Section extends vscode.TreeItem {
    constructor(label, collapsibleState, depth, lineNumber, toLine, fileName, command) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.depth = depth;
        this.lineNumber = lineNumber;
        this.toLine = toLine;
        this.fileName = fileName;
        this.command = command;
        this.children = [];
        this.parent = undefined; // The parent of a top level section must be undefined
        this.subfiles = [];
    }
}
exports.Section = Section;
class StructureTreeView {
    constructor(extension) {
        this.extension = extension;
        this._followCursor = true;
        this._treeDataProvider = this.extension.structureProvider;
        this._viewer = vscode.window.createTreeView('latex-structure', { treeDataProvider: this._treeDataProvider });
        vscode.commands.registerCommand('latex-structure.toggle-follow-cursor', () => {
            this._followCursor = !this._followCursor;
        });
    }
    traverseSectionTree(sections, fileName, lineNumber) {
        for (const node of sections) {
            if (node.fileName !== fileName) {
                continue;
            }
            if (node.lineNumber <= lineNumber && node.toLine >= lineNumber) {
                return node;
            }
            if (node.subfiles.length > 0 && node.subfiles.includes(fileName)) {
                return node;
            }
            const res = this.traverseSectionTree(node.children, fileName, lineNumber);
            if (res) {
                return res;
            }
        }
        return undefined;
    }
    showCursorIteme(e) {
        if (!this._followCursor || !this._viewer.visible) {
            return;
        }
        const line = e.selections[0].active.line;
        const f = e.textEditor.document.fileName;
        const currentNode = this.traverseSectionTree(this._treeDataProvider.ds, f, line);
        if (currentNode) {
            return this._viewer.reveal(currentNode, { select: true });
        }
        return;
    }
}
exports.StructureTreeView = StructureTreeView;
//# sourceMappingURL=structure.js.map