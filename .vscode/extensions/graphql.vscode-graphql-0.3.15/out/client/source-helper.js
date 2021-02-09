"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFragmentDependenciesForAST = exports.getFragmentDependencies = exports.SourceHelper = void 0;
const graphql_1 = require("graphql");
const nullthrows_1 = require("nullthrows");
class SourceHelper {
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
        this.fragmentDefinitions = new Map();
    }
    getTypeForVariableDefinitionNode(node) {
        let namedTypeNode = null;
        let isList = false;
        graphql_1.visit(node, {
            ListType(_listNode) {
                isList = true;
            },
            NamedType(namedNode) {
                namedTypeNode = namedNode;
            },
        });
        if (isList) {
            // TODO: This is not a name.value but a custom type that might confuse future programmers
            return "ListNode";
        }
        if (namedTypeNode) {
            // TODO: Handle this for object types/ enums/ custom scalars
            return namedTypeNode.name.value;
        }
        else {
            // TODO: Is handling all via string a correct fallback?
            return "String";
        }
    }
    validate(value, type) {
        try {
            switch (type) {
                case "Int":
                    if (parseInt(value)) {
                        return null;
                    }
                    break;
                case "Float":
                    if (parseFloat(value)) {
                        return null;
                    }
                    break;
                case "Boolean":
                    if (value === "true" || value === "false") {
                        return null;
                    }
                    break;
                case "String":
                    if (value.length && !Array.isArray(value)) {
                        return null;
                    }
                    break;
                default:
                    // For scalar types, it is impossible to know what data type they
                    // should be. Therefore we don't do any validation.
                    return null;
            }
        }
        catch (_a) {
            return `${value} is not a valid ${type}`;
        }
        return `${value} is not a valid ${type}`;
    }
    typeCast(value, type) {
        if (type === "Int") {
            return parseInt(value);
        }
        if (type === "Float") {
            return parseFloat(value);
        }
        if (type === "Boolean") {
            return Boolean(value);
        }
        if (type === "String") {
            return value;
        }
        // TODO: Does this note need to have an impact?
        // NOTE:
        // -- We don't do anything for non-nulls - the backend will throw a meaninful error
        // -- We treat custom types and lists similarly - as JSON - tedious for user to provide JSON but it works
        // -- We treat enums as string and that fits
        // Object type
        try {
            return JSON.parse(value);
        }
        catch (e) {
            this.outputChannel.appendLine(`Failed to parse user input as JSON, please use double quotes.`);
            return value;
        }
    }
    getFragmentDefinitions(projectConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            const sources = yield projectConfig.getDocuments();
            const fragmentDefinitions = this.fragmentDefinitions;
            sources.forEach(source => {
                graphql_1.visit(source.document, {
                    FragmentDefinition(node) {
                        const existingDef = fragmentDefinitions.get(node.name.value);
                        const newVal = graphql_1.print(node);
                        if (existingDef && existingDef.content !== newVal) {
                            fragmentDefinitions.set(node.name.value, {
                                definition: node,
                                content: newVal,
                                filePath: source.location,
                            });
                        }
                        else if (!existingDef) {
                            fragmentDefinitions.set(node.name.value, {
                                definition: node,
                                content: newVal,
                                filePath: source.location,
                            });
                        }
                    },
                });
            });
            return fragmentDefinitions;
        });
    }
    extractAllTemplateLiterals(document, tags = ["gql"]) {
        const text = document.getText();
        const documents = [];
        if (document.languageId === "graphql") {
            const text = document.getText();
            processGraphQLString(text, 0);
            return documents;
        }
        tags.forEach(tag => {
            // https://regex101.com/r/Pd5PaU/2
            const regExpGQL = new RegExp(tag + "\\s*`([\\s\\S]+?)`", "mg");
            let result;
            while ((result = regExpGQL.exec(text)) !== null) {
                const contents = result[1];
                // https://regex101.com/r/KFMXFg/2
                if (Boolean(contents.match("/${(.+)?}/g"))) {
                    // We are ignoring operations with template variables for now
                    continue;
                }
                try {
                    processGraphQLString(contents, result.index + 4);
                }
                catch (e) { }
            }
        });
        return documents;
        function processGraphQLString(text, offset) {
            try {
                const ast = graphql_1.parse(text);
                const operations = ast.definitions.filter(def => def.kind === "OperationDefinition");
                operations.forEach((op) => {
                    const filteredAst = Object.assign(Object.assign({}, ast), { definitions: ast.definitions.filter(def => {
                            if (def.kind === "OperationDefinition" && def !== op) {
                                return false;
                            }
                            return true;
                        }) });
                    const content = graphql_1.print(filteredAst);
                    documents.push({
                        content: content,
                        uri: document.uri.path,
                        position: document.positionAt(op.loc.start + offset),
                        definition: op,
                        ast: filteredAst,
                    });
                });
            }
            catch (e) { }
        }
    }
}
exports.SourceHelper = SourceHelper;
exports.getFragmentDependencies = (query, fragmentDefinitions) => __awaiter(void 0, void 0, void 0, function* () {
    // If there isn't context for fragment references,
    // return an empty array.
    if (!fragmentDefinitions) {
        return [];
    }
    // If the query cannot be parsed, validations cannot happen yet.
    // Return an empty array.
    let parsedQuery;
    try {
        parsedQuery = graphql_1.parse(query, {
            allowLegacySDLImplementsInterfaces: true,
            allowLegacySDLEmptyFields: true,
        });
    }
    catch (error) {
        return [];
    }
    return exports.getFragmentDependenciesForAST(parsedQuery, fragmentDefinitions);
});
exports.getFragmentDependenciesForAST = (parsedQuery, fragmentDefinitions) => __awaiter(void 0, void 0, void 0, function* () {
    if (!fragmentDefinitions) {
        return [];
    }
    const existingFrags = new Map();
    const referencedFragNames = new Set();
    graphql_1.visit(parsedQuery, {
        FragmentDefinition(node) {
            existingFrags.set(node.name.value, true);
        },
        FragmentSpread(node) {
            if (!referencedFragNames.has(node.name.value)) {
                referencedFragNames.add(node.name.value);
            }
        },
    });
    const asts = new Set();
    referencedFragNames.forEach(name => {
        if (!existingFrags.has(name) && fragmentDefinitions.has(name)) {
            asts.add(nullthrows_1.default(fragmentDefinitions.get(name)));
        }
    });
    const referencedFragments = [];
    asts.forEach(ast => {
        graphql_1.visit(ast.definition, {
            FragmentSpread(node) {
                if (!referencedFragNames.has(node.name.value) &&
                    fragmentDefinitions.get(node.name.value)) {
                    asts.add(nullthrows_1.default(fragmentDefinitions.get(node.name.value)));
                    referencedFragNames.add(node.name.value);
                }
            },
        });
        if (!existingFrags.has(ast.definition.name.value)) {
            referencedFragments.push(ast);
        }
    });
    return referencedFragments;
});
//# sourceMappingURL=source-helper.js.map