"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("babel-polyfill");
const graphql_language_service_server_1 = require("graphql-language-service-server");
// import { patchConfig } from "graphql-config-extension-prisma"
const start = () => {
    graphql_language_service_server_1.startServer({
        method: "node",
    })
        .then(() => { })
        .catch(err => {
        console.error(err);
    });
};
start();
//# sourceMappingURL=server.js.map