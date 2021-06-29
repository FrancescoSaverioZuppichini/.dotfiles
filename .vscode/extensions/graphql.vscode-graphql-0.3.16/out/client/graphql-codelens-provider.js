"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQLCodeLensProvider = void 0;
const vscode_1 = require("vscode");
const source_helper_1 = require("./source-helper");
const capitalize = require("capitalize");
class GraphQLCodeLensProvider {
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
        this.sourceHelper = new source_helper_1.SourceHelper(this.outputChannel);
    }
    provideCodeLenses(document, _token) {
        const literals = this.sourceHelper.extractAllTemplateLiterals(document, ["gql", "graphql"]);
        return literals.map(literal => {
            return new vscode_1.CodeLens(new vscode_1.Range(new vscode_1.Position(literal.position.line + 1, 0), new vscode_1.Position(literal.position.line + 1, 0)), {
                title: `Execute ${capitalize(literal.definition.operation)}`,
                command: "vscode-graphql.contentProvider",
                arguments: [literal],
            });
        });
    }
}
exports.GraphQLCodeLensProvider = GraphQLCodeLensProvider;
//# sourceMappingURL=graphql-codelens-provider.js.map