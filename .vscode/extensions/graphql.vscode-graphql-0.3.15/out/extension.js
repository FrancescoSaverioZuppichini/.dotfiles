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
exports.deactivate = exports.activate = void 0;
const path = require("path");
const vscode_1 = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const status_1 = require("./status");
const graphql_content_provider_1 = require("./client/graphql-content-provider");
const graphql_codelens_provider_1 = require("./client/graphql-codelens-provider");
const CustomInitializationFailedHandler_1 = require("./CustomInitializationFailedHandler");
function getConfig() {
    return vscode_1.workspace.getConfiguration("vscode-graphql", vscode_1.window.activeTextEditor ? vscode_1.window.activeTextEditor.document.uri : null);
}
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        let outputChannel = vscode_1.window.createOutputChannel("GraphQL Language Server");
        const config = getConfig();
        const { debug } = config;
        if (debug) {
            console.log('Extension "vscode-graphql" is now active!');
        }
        const serverModule = context.asAbsolutePath(path.join("out/server", "server.js"));
        const debugOptions = {
            execArgv: ["--nolazy", "--inspect=localhost:6009"],
        };
        let serverOptions = {
            run: {
                module: serverModule,
                transport: vscode_languageclient_1.TransportKind.ipc,
            },
            debug: {
                module: serverModule,
                transport: vscode_languageclient_1.TransportKind.ipc,
                options: Object.assign({}, (debug ? debugOptions : {})),
            },
        };
        let clientOptions = {
            documentSelector: [
                { scheme: "file", language: "graphql" },
                { scheme: "file", language: "javascript" },
                { scheme: "file", language: "javascriptreact" },
                { scheme: "file", language: "typescript" },
                { scheme: "file", language: "typescriptreact" },
            ],
            synchronize: {
                fileEvents: vscode_1.workspace.createFileSystemWatcher("**/{*.graphql,*.graphqls,*.gql,*.js,*.jsx,*.ts,*.tsx,graphql.config.*,.graphqlrc,.graphqlrc.*,package.json}"),
            },
            outputChannel: outputChannel,
            outputChannelName: "GraphQL Language Server",
            revealOutputChannelOn: vscode_languageclient_1.RevealOutputChannelOn.Never,
            initializationFailedHandler: CustomInitializationFailedHandler_1.CustomInitializationFailedHandler(outputChannel),
        };
        const client = new vscode_languageclient_1.LanguageClient("vscode-graphql", "GraphQL Language Server", serverOptions, clientOptions, debug);
        const disposableClient = client.start();
        context.subscriptions.push(disposableClient);
        const commandIsDebugging = vscode_1.commands.registerCommand("vscode-graphql.isDebugging", () => {
            outputChannel.appendLine(`is in debug mode: ${!!debug}`);
        });
        context.subscriptions.push(commandIsDebugging);
        // Manage Status Bar
        context.subscriptions.push(status_1.default);
        client.onReady().then(() => {
            status_1.initStatusBar(status_1.default, client, vscode_1.window.activeTextEditor);
        });
        const settings = vscode_1.workspace.getConfiguration("vscode-graphql");
        const registerCodeLens = () => {
            context.subscriptions.push(vscode_1.languages.registerCodeLensProvider([
                "javascript",
                "typescript",
                "javascriptreact",
                "typescriptreact",
                "graphql",
            ], new graphql_codelens_provider_1.GraphQLCodeLensProvider(outputChannel)));
        };
        if (settings.showExecCodelens) {
            registerCodeLens();
        }
        vscode_1.workspace.onDidChangeConfiguration(() => {
            const newSettings = vscode_1.workspace.getConfiguration("vscode-graphql");
            if (newSettings.showExecCodeLens) {
                registerCodeLens();
            }
        });
        const commandContentProvider = vscode_1.commands.registerCommand("vscode-graphql.contentProvider", (literal) => __awaiter(this, void 0, void 0, function* () {
            const uri = vscode_1.Uri.parse("graphql://authority/graphql");
            const panel = vscode_1.window.createWebviewPanel("executionReusltWebView", "GraphQL Execution Result", vscode_1.ViewColumn.Two, {});
            const contentProvider = new graphql_content_provider_1.GraphQLContentProvider(uri, outputChannel, literal, panel);
            const registration = vscode_1.workspace.registerTextDocumentContentProvider("graphql", contentProvider);
            context.subscriptions.push(registration);
            const html = yield contentProvider.getCurrentHtml();
            panel.webview.html = html;
        }));
        context.subscriptions.push(commandContentProvider);
        vscode_1.commands.registerCommand("vscode-graphql.restart", () => __awaiter(this, void 0, void 0, function* () {
            yield client.stop();
            yield client.start();
        }));
    });
}
exports.activate = activate;
function deactivate() {
    console.log('Extension "vscode-graphql" is now de-active!');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map