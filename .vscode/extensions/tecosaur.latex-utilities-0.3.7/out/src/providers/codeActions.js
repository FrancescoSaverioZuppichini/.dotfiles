"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CodeActions {
    constructor(extension) {
        this.extension = extension;
    }
    provideCodeActions(document, range, context, token) {
        const actions = [];
        context.diagnostics
            .filter(d => d.source && this.extension.diagnoser.enabledLinters.indexOf(d.source) !== -1)
            .forEach(d => {
            if (d.source === undefined) {
                return;
            }
            if (this.extension.diagnoser.diagnosticSources[d.source].actions.has(d.range)) {
                const codeAction = this.extension.diagnoser.diagnosticSources[d.source].actions.get(d.range);
                if (codeAction !== undefined) {
                    actions.push(codeAction);
                }
            }
        });
        return actions;
    }
    runCodeAction(document, range, source, message) {
        if (this.extension.diagnoser.enabledLinters.indexOf(source) === -1) {
            return;
        }
        else {
            this.extension.diagnoser.diagnosticSources[source].codeAction(document, range, source, message);
        }
    }
}
exports.CodeActions = CodeActions;
//# sourceMappingURL=codeActions.js.map