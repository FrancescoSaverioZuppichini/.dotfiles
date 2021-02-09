"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const utils_1 = require("../utils");
class TikzCodeLense {
    async provideCodeLenses(document) {
        if (!vscode.workspace.getConfiguration('latex-utilities.tikzpreview').get('enabled')) {
            return [];
        }
        const matches = findTikzPictures(document);
        return matches.map(match => new vscode.CodeLens(match.range, {
            title: 'View TikZ Picture',
            tooltip: 'Open view of this TikZ Picture',
            command: 'latex-utilities.viewtikzpicture',
            arguments: [match.document, match.range]
        }));
    }
}
exports.TikzCodeLense = TikzCodeLense;
function findTikzPictures(document) {
    const matches = [];
    const startRegex = /\\begin{(?:tikzpicture|\w*tikz\w*)}/;
    const endRegex = /\\end{(?:tikzpicture|\w*tikz\w*)}/;
    for (let i = 0; i < document.lineCount; i++) {
        let line = document.lineAt(i);
        let text = utils_1.stripComments(line.text, '%');
        const startMatch = text.match(startRegex);
        if (!startMatch) {
            continue;
        }
        const startColumn = startMatch.index;
        if (startColumn === null || startColumn === undefined) {
            continue;
        }
        let lineNo = i;
        let endMatch = null;
        let endColumn;
        do {
            if (lineNo - 1 === document.lineCount) {
                continue;
            }
            line = document.lineAt(++lineNo);
            text = line.text.substr(0, 1000);
            endMatch = text.match(endRegex);
            if (endMatch && endMatch.index !== undefined) {
                endColumn = endMatch.index + endMatch[0].length;
            }
        } while (!endMatch);
        if (endColumn === undefined) {
            continue;
        }
        matches.push({
            document,
            range: new vscode.Range(i, startColumn, lineNo, endColumn)
        });
        i = lineNo;
    }
    return matches;
}
//# sourceMappingURL=tikzcodelense.js.map