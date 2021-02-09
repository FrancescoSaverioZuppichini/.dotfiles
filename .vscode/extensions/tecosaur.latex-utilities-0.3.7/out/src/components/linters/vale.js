"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const ISSUE_MAP = [
    {
        conditions: {
            Message: /^(?:Consider using|Prefer|Use) '(.+)' (?:instead|over)(?: of)? '(.+)'$/i
            // catches: TheEconomist.(Terms,Punctuation),
            // PlainLanguage.(ComplexWords,Contractions,Wordiness,Words)
            // proselint.(AnimalLabels,Diacritical,GenderBias,GroupTerms,Nonwords)
            // 18F.(Abbreviations,Brands,Contractions,Terms)
        },
        implications: issue => {
            const match = issue.Message.match(/(?:Consider using|Prefer|Use) '(.+)' (?:instead|over)(?: of)? '(.+)'$/i);
            if (match) {
                let replacement = match[1];
                // make capitalisation match
                if (match[2][0].toUpperCase() === match[2][0]) {
                    replacement = replacement[0].toUpperCase() + replacement.slice(1);
                }
                return { replacement, tags: [vscode.DiagnosticTag.Deprecated] };
            }
            else {
                return {};
            }
        }
    },
    {
        conditions: {
            Check: /^vale\.Editorializing|write-good\.(?:So|Illusions)|TheEconomist\.UnnecessaryWords|proselint\.But/
        },
        implications: _issue => ({ tags: [vscode.DiagnosticTag.Deprecated], replacement: '' })
    },
    {
        conditions: {
            Message: /^Avoid using '(.+)'$/i
            // catches most of Joblint
        },
        implications: _issue => ({ tags: [vscode.DiagnosticTag.Unnecessary] })
    },
    {
        conditions: {
            Check: /^write-good\.Weasel/
        },
        implications: _issue => ({ tags: [vscode.DiagnosticTag.Unnecessary] })
    }
];
function findIssueImplications(issue) {
    for (let i = 0; i < ISSUE_MAP.length; i++) {
        const item = ISSUE_MAP[i];
        let meetsConditions = true;
        for (const condition in item.conditions) {
            // @ts-ignore tslint is stupid, item.conditions[condition] is fine
            if (!item.conditions[condition].test(issue[condition])) {
                meetsConditions = false;
                break;
            }
        }
        if (meetsConditions) {
            return item.implications(issue);
        }
    }
    return undefined;
}
exports.vale = {
    command: (fileName, extraArguments = []) => [
        'vale',
        '--no-exit',
        '--output',
        'JSON',
        ...extraArguments,
        fileName
    ],
    actions: new Map(),
    diagnostics: vscode.languages.createDiagnosticCollection('vale'),
    codeAction: (document, range, _code, replacement) => {
        if (!vscode.window.activeTextEditor) {
            return;
        }
        vscode.window.activeTextEditor.edit(editBuilder => {
            editBuilder.replace(range, replacement);
        }, { undoStopBefore: true, undoStopAfter: true });
    },
    parser: function (document, tempfile, commandOutput, changes) {
        this.diagnostics.clear();
        this.actions.clear();
        const diagnostics = [];
        const result = JSON.parse(commandOutput)[tempfile];
        const processDiagnostic = (issue) => {
            // vale prints one-based locations but code wants zero-based, so adjust
            // accordingly
            // let range = new vscode.Range(issue.Line - 1, issue.Span[0] - 1, issue.Line - 1, issue.Span[1])
            let start_position = new vscode.Position(issue.Line - 1, issue.Span[0] - 1);
            let end_position = new vscode.Position(issue.Line - 1, issue.Span[1]);
            for (let i = 0; i < changes.length; i++) {
                if (end_position.isBefore(changes[i][0].start)) {
                    break;
                }
                else {
                    // Lines to add
                    let lineDelta = changes[i][0].end.line - changes[i][0].start.line;
                    // Characters to add
                    let characterDelta = 0;
                    // if change is partially on the same line and before start_position
                    if (start_position.line + lineDelta == changes[i][0].end.line && start_position.line > changes[i][0].start.line) {
                        characterDelta = changes[i][0].end.character + 1;
                    }
                    // if change is completely on the same line and before start_position
                    if (start_position.line + lineDelta == changes[i][0].end.line && start_position.line + lineDelta == changes[i][0].start.line) {
                        characterDelta = changes[i][0].end.character - changes[i][0].start.character + 1 - changes[i][1]; // minus size of dummy 
                    }
                    // If action is actually related to an argument of a command (a bit hacky)
                    if (start_position.line == changes[i][0].start.line && start_position.character == changes[i][0].start.character) {
                        characterDelta = changes[i][0].end.character - changes[i][0].start.character + 1 - changes[i][1] - 1; // minus the last bracket for the argument 
                    }
                    // Translation
                    start_position = start_position.translate(lineDelta, characterDelta);
                    end_position = end_position.translate(lineDelta, characterDelta);
                }
            }
            const range = new vscode.Range(start_position, end_position);
            const message = issue.Link
                ? `${issue.Message} (${issue.Check}, see ${issue.Link})`
                : `${issue.Message} (${issue.Check})`;
            let diagnostic = new vscode.Diagnostic(range, message, {
                suggestion: vscode.DiagnosticSeverity.Hint,
                warning: vscode.DiagnosticSeverity.Warning,
                error: vscode.DiagnosticSeverity.Warning
            }[issue.Severity]);
            diagnostic.source = 'vale';
            diagnostic.code = issue.Check;
            diagnostic = this.applyIssueImplications(document, diagnostic, issue);
            diagnostics.push(diagnostic);
        };
        for (const issue of result) {
            processDiagnostic(issue);
        }
        this.diagnostics.set(document.uri, diagnostics);
    },
    applyIssueImplications: function (document, diagnostic, issue) {
        const implications = findIssueImplications(issue);
        if (implications !== undefined) {
            if (implications.tags !== undefined) {
                diagnostic.tags = implications.tags;
            }
            if (implications.replacement !== undefined) {
                const codeAction = new vscode.CodeAction(implications.replacement === '' ? 'Remove' : `Replace with '${implications.replacement}'`, vscode.CodeActionKind.QuickFix);
                codeAction.command = {
                    title: 'Replace value',
                    command: 'latex-utilities.code-action',
                    arguments: [document, diagnostic.range, diagnostic.source, implications.replacement]
                };
                codeAction.isPreferred = true;
                this.actions.set(diagnostic.range, codeAction);
            }
        }
        return diagnostic;
    }
};
//# sourceMappingURL=vale.js.map