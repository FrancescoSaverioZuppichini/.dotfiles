"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomInitializationFailedHandler = void 0;
function CustomInitializationFailedHandler(outputChannel) {
    return (error) => {
        outputChannel.appendLine(`Caught the error ${error}`);
        error.stack && outputChannel.appendLine(error.stack);
        return false;
    };
}
exports.CustomInitializationFailedHandler = CustomInitializationFailedHandler;
//# sourceMappingURL=CustomInitializationFailedHandler.js.map