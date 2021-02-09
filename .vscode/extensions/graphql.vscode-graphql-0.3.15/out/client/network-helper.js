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
exports.NetworkHelper = void 0;
const source_helper_1 = require("./source-helper");
const graphql_1 = require("graphql");
const apollo_client_1 = require("apollo-client");
const apollo_link_error_1 = require("apollo-link-error");
const graphql_tag_1 = require("graphql-tag");
const apollo_link_http_1 = require("apollo-link-http");
const apollo_link_ws_1 = require("apollo-link-ws");
const apollo_cache_inmemory_1 = require("apollo-cache-inmemory");
const node_fetch_1 = require("node-fetch");
const ws = require("ws");
const apollo_link_1 = require("apollo-link");
class NetworkHelper {
    constructor(outputChannel, sourceHelper) {
        this.outputChannel = outputChannel;
        this.sourceHelper = sourceHelper;
    }
    buildClient({ operation, endpoint, updateCallback, }) {
        const httpLink = apollo_link_http_1.createHttpLink({
            uri: endpoint.url,
            headers: endpoint.headers,
            fetch: node_fetch_1.default,
        });
        const errorLink = apollo_link_error_1.onError(({ graphQLErrors, networkError }) => {
            if (networkError) {
                updateCallback(networkError.toString(), operation);
            }
            if (graphQLErrors && graphQLErrors.length > 0) {
                updateCallback(formatData({ errors: graphQLErrors }), operation);
            }
        });
        const wsEndpointURL = endpoint.url.replace(/^http/, "ws");
        const wsLink = new apollo_link_ws_1.WebSocketLink({
            uri: wsEndpointURL,
            options: {
                reconnect: true,
                inactivityTimeout: 30000,
            },
            webSocketImpl: ws,
        });
        return new apollo_client_1.default({
            link: apollo_link_1.ApolloLink.from([
                errorLink,
                apollo_link_1.ApolloLink.split(() => {
                    return operation === "subscription";
                }, wsLink, httpLink),
            ]),
            cache: new apollo_cache_inmemory_1.InMemoryCache({
                addTypename: false,
            }),
        });
    }
    executeOperation({ endpoint, literal, variables, updateCallback, projectConfig, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const operationTypes = [];
            const operationNames = [];
            graphql_1.visit(literal.ast, {
                OperationDefinition(node) {
                    var _a;
                    operationTypes.push(node.operation);
                    operationNames.push(((_a = node.name) === null || _a === void 0 ? void 0 : _a.value) || "");
                },
            });
            const fragmentDefinitions = yield this.sourceHelper.getFragmentDefinitions(projectConfig);
            const fragmentInfos = yield source_helper_1.getFragmentDependenciesForAST(literal.ast, fragmentDefinitions);
            fragmentInfos.forEach(fragmentInfo => {
                literal.content = fragmentInfo.content + "\n" + literal.content;
            });
            const parsedOperation = graphql_tag_1.default `
      ${literal.content}
    `;
            return Promise.all(operationTypes.map((operation) => __awaiter(this, void 0, void 0, function* () {
                this.outputChannel.appendLine(`NetworkHelper: operation: ${operation}`);
                this.outputChannel.appendLine(`NetworkHelper: endpoint: ${endpoint.url}`);
                const apolloClient = this.buildClient({
                    operation,
                    endpoint,
                    updateCallback,
                });
                if (operation === "subscription") {
                    yield apolloClient
                        .subscribe({
                        query: parsedOperation,
                        variables,
                    })
                        .subscribe({
                        next(data) {
                            updateCallback(formatData(data), operation);
                        },
                    });
                }
                else {
                    if (operation === "query") {
                        const data = yield apolloClient.query({
                            query: parsedOperation,
                            variables,
                            errorPolicy: "all",
                        });
                        updateCallback(formatData(data), operation);
                    }
                    else {
                        const data = yield apolloClient.mutate({
                            mutation: parsedOperation,
                            variables,
                            errorPolicy: "all",
                        });
                        updateCallback(formatData(data), operation);
                    }
                }
            })));
        });
    }
}
exports.NetworkHelper = NetworkHelper;
function formatData({ data, errors }) {
    return JSON.stringify({ data, errors }, null, 2);
}
//# sourceMappingURL=network-helper.js.map