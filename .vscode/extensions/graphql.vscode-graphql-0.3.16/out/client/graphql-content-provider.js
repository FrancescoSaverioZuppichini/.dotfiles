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
exports.GraphQLContentProvider = void 0;
const vscode_1 = require("vscode");
const graphql_config_1 = require("graphql-config");
const graphql_1 = require("graphql");
const network_helper_1 = require("./network-helper");
const source_helper_1 = require("./source-helper");
// TODO: remove residue of previewHtml API https://github.com/microsoft/vscode/issues/62630
// We update the panel directly now in place of a event based update API (we might make a custom event updater and remove panel dep though)
class GraphQLContentProvider {
    constructor(uri, outputChannel, literal, panel) {
        // Event emitter which invokes document updates
        this._onDidChange = new vscode_1.EventEmitter();
        this.html = ""; // HTML document buffer
        this.timeout = ms => new Promise(res => setTimeout(res, ms));
        this.uri = uri;
        this.outputChannel = outputChannel;
        this.sourceHelper = new source_helper_1.SourceHelper(this.outputChannel);
        this.networkHelper = new network_helper_1.NetworkHelper(this.outputChannel, this.sourceHelper);
        this.panel = panel;
        this.rootDir = vscode_1.workspace.getWorkspaceFolder(vscode_1.Uri.file(literal.uri));
        this.literal = literal;
        this.panel.webview.options = {
            enableScripts: true,
        };
        this.loadProvider()
            .then()
            .catch(err => {
            this.html = err.toString();
        });
    }
    getCurrentHtml() {
        return new Promise(resolve => {
            resolve(this.html);
        });
    }
    updatePanel() {
        this.panel.webview.html = this.html;
    }
    getVariablesFromUser(variableDefinitionNodes) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.timeout(500);
            let variables = {};
            for (let node of variableDefinitionNodes) {
                const variableType = this.sourceHelper.getTypeForVariableDefinitionNode(node);
                variables = Object.assign(Object.assign({}, variables), { [`${node.variable.name.value}`]: this.sourceHelper.typeCast((yield vscode_1.window.showInputBox({
                        ignoreFocusOut: true,
                        placeHolder: `Please enter the value for ${node.variable.name.value}`,
                        validateInput: (value) => __awaiter(this, void 0, void 0, function* () { return this.sourceHelper.validate(value, variableType); }),
                    })), variableType) });
            }
            return variables;
        });
    }
    getEndpointName(endpointNames) {
        return __awaiter(this, void 0, void 0, function* () {
            // Endpoints extensions docs say that at least "default" will be there
            let endpointName = endpointNames[0];
            if (endpointNames.length > 1) {
                const pickedValue = yield vscode_1.window.showQuickPick(endpointNames, {
                    canPickMany: false,
                    ignoreFocusOut: true,
                    placeHolder: "Select an endpoint",
                });
                if (pickedValue) {
                    endpointName = pickedValue;
                }
            }
            return endpointName;
        });
    }
    validUrlFromSchema(pathOrUrl) {
        return Boolean(pathOrUrl.match(/^https?:\/\//g));
    }
    loadEndpoint(projectConfig) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            // I dont think this is needed in 3.0 any more.
            // if (config && !projectConfig) {
            //   projectConfig = this.patchProjectConfig(config) as GraphQLProjectConfig
            // }
            let endpoints = (_a = projectConfig === null || projectConfig === void 0 ? void 0 : projectConfig.extensions) === null || _a === void 0 ? void 0 : _a.endpoints;
            if (!endpoints) {
                endpoints = {
                    default: { url: "" },
                };
                this.update(this.uri);
                this.updatePanel();
                if (projectConfig === null || projectConfig === void 0 ? void 0 : projectConfig.schema) {
                    this.outputChannel.appendLine(`Warning: endpoints missing from graphql config. will try 'schema' value(s) instead`);
                    const schema = projectConfig.schema;
                    if (schema && Array.isArray(schema)) {
                        schema.map(s => {
                            if (this.validUrlFromSchema(s)) {
                                endpoints.default.url = s.toString();
                            }
                        });
                    }
                    else if (schema && this.validUrlFromSchema(schema)) {
                        endpoints.default.url = schema.toString();
                    }
                }
                if (!((_b = endpoints === null || endpoints === void 0 ? void 0 : endpoints.default) === null || _b === void 0 ? void 0 : _b.url)) {
                    this.html =
                        "Warning: No Endpoints configured. Config schema contains no URLs";
                    this.update(this.uri);
                    this.updatePanel();
                    return null;
                }
                else {
                    this.outputChannel.appendLine(`Warning: No Endpoints configured. Attempting to execute operation with 'config.schema' value '${endpoints.default.url}'`);
                }
            }
            const endpointNames = Object.keys(endpoints);
            if (endpointNames.length === 0) {
                this.outputChannel.appendLine(`Error: endpoint data missing from graphql config endpoints extension`);
                this.html =
                    "Error: endpoint data missing from graphql config endpoints extension";
                this.update(this.uri);
                this.updatePanel();
                return null;
            }
            const endpointName = yield this.getEndpointName(endpointNames);
            return endpoints[endpointName] || endpoints.default;
        });
    }
    loadProvider() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const rootDir = vscode_1.workspace.getWorkspaceFolder(vscode_1.Uri.file(this.literal.uri));
                if (!rootDir) {
                    this.outputChannel.appendLine(`Error: this file is outside the workspace.`);
                    this.html = "Error: this file is outside the workspace.";
                    this.update(this.uri);
                    this.updatePanel();
                    return;
                }
                else {
                    const config = yield graphql_config_1.loadConfig({ rootDir: rootDir.uri.fsPath });
                    let projectConfig = config === null || config === void 0 ? void 0 : config.getProjectForFile(this.literal.uri);
                    if (!projectConfig) {
                        return;
                    }
                    const endpoint = yield this.loadEndpoint(projectConfig);
                    if (endpoint) {
                        let variableDefinitionNodes = [];
                        graphql_1.visit(this.literal.ast, {
                            VariableDefinition(node) {
                                variableDefinitionNodes.push(node);
                            },
                        });
                        const updateCallback = (data, operation) => {
                            if (operation === "subscription") {
                                this.html = `<pre>${data}</pre>` + this.html;
                            }
                            else {
                                this.html += `<pre>${data}</pre>`;
                            }
                            this.update(this.uri);
                            this.updatePanel();
                        };
                        if (variableDefinitionNodes.length > 0) {
                            const variables = yield this.getVariablesFromUser(variableDefinitionNodes);
                            yield this.networkHelper.executeOperation({
                                endpoint,
                                literal: this.literal,
                                variables,
                                updateCallback,
                                projectConfig,
                            });
                        }
                        else {
                            yield this.networkHelper.executeOperation({
                                endpoint,
                                literal: this.literal,
                                variables: {},
                                updateCallback,
                                projectConfig,
                            });
                        }
                    }
                }
            }
            catch (err) {
                if (err.networkError) {
                    this.html += err.networkError;
                }
                throw err;
            }
        });
    }
    loadConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            const rootDir = this.rootDir;
            if (!rootDir) {
                this.outputChannel.appendLine(`Error: this file is outside the workspace.`);
                this.html = "Error: this file is outside the workspace.";
                this.update(this.uri);
                this.updatePanel();
                return;
            }
            else {
                const config = yield graphql_config_1.loadConfig({ rootDir: rootDir.uri.fsPath });
                let projectConfig = config === null || config === void 0 ? void 0 : config.getProjectForFile(this.literal.uri);
                if (!projectConfig.schema) {
                    this.outputChannel.appendLine(`Error: schema from graphql config`);
                    this.html = "Error: schema missing from graphql config";
                    this.update(this.uri);
                    this.updatePanel();
                    return;
                }
                return projectConfig;
            }
        });
    }
    get onDidChange() {
        return this._onDidChange.event;
    }
    update(uri) {
        this._onDidChange.fire(uri);
    }
    provideTextDocumentContent(_) {
        return this.html;
    }
}
exports.GraphQLContentProvider = GraphQLContentProvider;
//# sourceMappingURL=graphql-content-provider.js.map