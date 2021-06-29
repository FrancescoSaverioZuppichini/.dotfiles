"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Viewer = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const cs = __importStar(require("cross-spawn"));
const utils_1 = require("../utils/utils");
const utils_2 = require("../utils/utils");
const webview_1 = require("../utils/webview");
const theme_1 = require("../utils/theme");
class Client {
    constructor(viewer, websocket) {
        this.viewer = viewer;
        this.websocket = websocket;
    }
    send(message) {
        this.websocket.send(JSON.stringify(message));
    }
}
class PdfViewerPanel {
    constructor(pdfFilePath, panel) {
        this.pdfFilePath = pdfFilePath;
        this.webviewPanel = panel;
        panel.webview.onDidReceiveMessage((msg) => {
            switch (msg.type) {
                case 'state': {
                    this._state = msg.state;
                    break;
                }
                default: {
                    break;
                }
            }
        });
    }
    get state() {
        return this._state;
    }
}
class PdfViewerPanelSerializer {
    constructor(extension) {
        this.extension = extension;
    }
    async deserializeWebviewPanel(panel, state0) {
        this.extension.logger.addLogMessage(`Restoring the PDF viewer at the column ${panel.viewColumn} from the state: ${JSON.stringify(state0)}`);
        const state = state0.state;
        const pdfFilePath = state.path;
        if (!pdfFilePath) {
            this.extension.logger.addLogMessage('Error of restoring PDF viewer: the path of PDF file is undefined.');
            panel.webview.html = '<!DOCTYPE html> <html lang="en"><meta charset="utf-8"/><br>The path of PDF file is undefined.</html>';
            return;
        }
        if (!fs.existsSync(pdfFilePath)) {
            const s = utils_1.escapeHtml(pdfFilePath);
            this.extension.logger.addLogMessage(`Error of restoring PDF viewer: file not found ${pdfFilePath}.`);
            panel.webview.html = `<!DOCTYPE html> <html lang="en"><meta charset="utf-8"/><br>File not found: ${s}</html>`;
            return;
        }
        panel.webview.html = await this.extension.viewer.getPDFViewerContent(pdfFilePath);
        const pdfPanel = new PdfViewerPanel(pdfFilePath, panel);
        this.extension.viewer.pushPdfViewerPanel(pdfPanel);
        return;
    }
}
class Viewer {
    constructor(extension) {
        this.webviewPanels = new Map();
        this.clients = Object.create(null);
        this.extension = extension;
        this.pdfViewerPanelSerializer = new PdfViewerPanelSerializer(extension);
    }
    createClients(pdfFilePath) {
        const key = pdfFilePath.toLocaleUpperCase();
        this.clients[key] = this.clients[key] || new Set();
        if (!this.webviewPanels.has(key)) {
            this.webviewPanels.set(key, new Set());
        }
    }
    /**
     * Returns the set of client instances of a PDF file.
     * Returns `undefined` if the viewer have not recieved any request for the PDF file.
     *
     * @param pdfFilePath The path of a PDF file.
     */
    getClients(pdfFilePath) {
        return this.clients[pdfFilePath.toLocaleUpperCase()];
    }
    getPanelSet(pdfFilePath) {
        return this.webviewPanels.get(pdfFilePath.toLocaleUpperCase());
    }
    /**
     * Refreshes PDF viewers of `sourceFile`. If `sourceFile` is `undefined`,
     * refreshes all the PDF viewers. If `sourceFile` and `viewer` are not `undefined`,
     * only the `viewer` is refreshed.
     *
     * @param sourceFile The path of a LaTeX file.
     * @param viewer The PDF viewer to be refreshed.
     */
    refreshExistingViewer(sourceFile, viewer) {
        if (!sourceFile) {
            Object.keys(this.clients).forEach(key => {
                this.clients[key].forEach(client => {
                    client.send({ type: 'refresh' });
                });
            });
            return true;
        }
        const pdfFile = this.extension.manager.tex2pdf(sourceFile, true);
        const clients = this.getClients(pdfFile);
        if (clients !== undefined) {
            let refreshed = false;
            // Check all viewer clients with the same path
            clients.forEach(client => {
                // Refresh only correct type
                if (viewer === undefined || client.viewer === viewer) {
                    this.extension.logger.addLogMessage(`Refresh PDF viewer for ${pdfFile}`);
                    client.send({ type: 'refresh' });
                    refreshed = true;
                }
            });
            // Return if refreshed anyone
            if (refreshed) {
                return true;
            }
        }
        this.extension.logger.addLogMessage(`No PDF viewer connected for ${pdfFile}`);
        return false;
    }
    checkViewer(sourceFile, respectOutDir = true) {
        const pdfFile = this.extension.manager.tex2pdf(sourceFile, respectOutDir);
        if (!fs.existsSync(pdfFile)) {
            this.extension.logger.addLogMessage(`Cannot find PDF file ${pdfFile}`);
            this.extension.logger.displayStatus('check', 'statusBar.foreground', `Cannot view file PDF file. File not found: ${pdfFile}`, 'warning');
            return;
        }
        if (this.extension.server.address === undefined) {
            this.extension.logger.addLogMessage('Cannot establish server connection.');
            return;
        }
        const url = `http://127.0.0.1:${this.extension.server.port}/viewer.html?file=${utils_2.encodePathWithPrefix(pdfFile)}`;
        this.extension.logger.addLogMessage(`Serving PDF file at ${url}`);
        this.extension.logger.addLogMessage(`The encoded path is ${pdfFile}`);
        return url;
    }
    /**
     * Opens the PDF file of `sourceFile` in the browser.
     *
     * @param sourceFile The path of a LaTeX file.
     */
    async openBrowser(sourceFile) {
        const url = this.checkViewer(sourceFile, true);
        if (!url) {
            return;
        }
        const pdfFile = this.extension.manager.tex2pdf(sourceFile);
        this.createClients(pdfFile);
        try {
            await vscode.env.openExternal(vscode.Uri.parse(url));
            this.extension.logger.addLogMessage(`Open PDF viewer for ${pdfFile}`);
        }
        catch (e) {
            void vscode.window.showInputBox({
                prompt: 'Unable to open browser. Please copy and visit this link.',
                value: url
            });
            this.extension.logger.addLogMessage(`Something bad happened when opening PDF viewer for ${pdfFile}: ${e}`);
        }
    }
    /**
     * Opens the PDF file of `sourceFile` in the internal PDF viewer.
     *
     * @param sourceFile The path of a LaTeX file.
     * @param respectOutDir
     * @param tabEditorGroup
     * @param preserveFocus
     */
    async openTab(sourceFile, respectOutDir, tabEditorGroup, preserveFocus = true) {
        var _a;
        const url = this.checkViewer(sourceFile, respectOutDir);
        if (!url) {
            return;
        }
        const activeDocument = (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document;
        const pdfFile = this.extension.manager.tex2pdf(sourceFile, respectOutDir);
        const panel = await this.createPdfViewerPanel(pdfFile, vscode.ViewColumn.Active);
        if (!panel) {
            return;
        }
        if (activeDocument) {
            await webview_1.openWebviewPanel(panel.webviewPanel, tabEditorGroup, activeDocument, preserveFocus);
        }
        this.extension.logger.addLogMessage(`Open PDF tab for ${pdfFile}`);
    }
    async createPdfViewerPanel(pdfFilePath, viewColumn) {
        if (this.extension.server.port === undefined) {
            this.extension.logger.addLogMessage('Server port is undefined');
            return;
        }
        const htmlContent = await this.getPDFViewerContent(pdfFilePath);
        const panel = vscode.window.createWebviewPanel('latex-workshop-pdf', path.basename(pdfFilePath), viewColumn, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        panel.webview.html = htmlContent;
        const pdfPanel = new PdfViewerPanel(pdfFilePath, panel);
        this.pushPdfViewerPanel(pdfPanel);
        return pdfPanel;
    }
    pushPdfViewerPanel(pdfPanel) {
        this.createClients(pdfPanel.pdfFilePath);
        const panelSet = this.getPanelSet(pdfPanel.pdfFilePath);
        if (!panelSet) {
            return;
        }
        panelSet.add(pdfPanel);
        pdfPanel.webviewPanel.onDidDispose(() => {
            panelSet.delete(pdfPanel);
        });
    }
    getKeyboardEventConfig() {
        const configuration = vscode.workspace.getConfiguration('latex-workshop');
        const setting = configuration.get('viewer.pdf.internal.keyboardEvent', 'auto');
        if (setting === 'auto') {
            return os.platform() !== 'linux';
        }
        else if (setting === 'force') {
            return true;
        }
        else {
            return false;
        }
    }
    /**
     * Returns the HTML content of the internal PDF viewer.
     *
     * @param pdfFile The path of a PDF file to be opened.
     */
    async getPDFViewerContent(pdfFile) {
        const serverPort = this.extension.server.port;
        // viewer/viewer.js automatically requests the file to server.ts, and server.ts decodes the encoded path of PDF file.
        const origUrl = `http://127.0.0.1:${serverPort}/viewer.html?incode=1&file=${utils_2.encodePathWithPrefix(pdfFile)}`;
        const url = await vscode.env.asExternalUri(vscode.Uri.parse(origUrl));
        const iframeSrcUrl = url.toString(true);
        this.extension.logger.addLogMessage(`The internal PDF viewer url: ${iframeSrcUrl}`);
        const rebroadcast = this.getKeyboardEventConfig();
        return `
            <!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src http://localhost:${serverPort} http://127.0.0.1:${serverPort}; base-uri 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';"></head>
            <body><iframe id="preview-panel" class="preview-panel" src="${iframeSrcUrl}" style="position:absolute; border: none; left: 0; top: 0; width: 100%; height: 100%;">
            </iframe>
            <script>
            // When the tab gets focus again later, move the
            // the focus to the iframe so that keyboard navigation works in the pdf.
            const iframe = document.getElementById('preview-panel');
            window.onfocus = function() {
                setTimeout(function() { // doesn't work immediately
                    iframe.contentWindow.focus();
                }, 100);
            }

            const vsStore = acquireVsCodeApi();
            // To enable keyboard shortcuts of VS Code when the iframe is focused,
            // we have to dispatch keyboard events in the parent window.
            // See https://github.com/microsoft/vscode/issues/65452#issuecomment-586036474
            window.addEventListener('message', (e) => {
                if (e.origin !== 'http://127.0.0.1:${serverPort}') {
                    return;
                }
                switch (e.data.type) {
                    case 'initialized': {
                        const state = vsStore.getState();
                        if (state) {
                            state.type = 'restore_state';
                            iframe.contentWindow.postMessage(state, '*');
                        }
                        break;
                    }
                    case 'keyboard_event': {
                        if (${rebroadcast}) {
                            window.dispatchEvent(new KeyboardEvent('keydown', e.data.event));
                        }
                        break;
                    }
                    case 'state': {
                        vsStore.setState(e.data);
                        break;
                    }
                    default:
                        break;
                }
                vsStore.postMessage(e.data)
            });
            </script>
            </body></html>
        `;
    }
    /**
     * Opens the PDF file of `sourceFile` in the external PDF viewer.
     *
     * @param sourceFile The path of a LaTeX file.
     */
    openExternal(sourceFile) {
        const pdfFile = this.extension.manager.tex2pdf(sourceFile);
        const configuration = vscode.workspace.getConfiguration('latex-workshop');
        let command = configuration.get('view.pdf.external.viewer.command');
        let args = configuration.get('view.pdf.external.viewer.args');
        if (!command) {
            switch (process.platform) {
                case 'win32':
                    command = 'SumatraPDF.exe';
                    args = ['%PDF%'];
                    break;
                case 'linux':
                    command = 'xdg-open';
                    args = ['%PDF%'];
                    break;
                case 'darwin':
                    command = 'open';
                    args = ['%PDF%'];
                    break;
                default:
                    break;
            }
        }
        if (args) {
            args = args.map(arg => arg.replace('%PDF%', pdfFile));
        }
        this.extension.logger.addLogMessage(`Execute the external PDF viewer: command ${command}, args ${args}`);
        this.extension.manager.setEnvVar();
        cs.spawn(command, args, { cwd: path.dirname(sourceFile), detached: true });
        this.extension.logger.addLogMessage(`Open external viewer for ${pdfFile}`);
    }
    /**
     * Handles the request from the internal PDF viewer.
     *
     * @param websocket The WebSocket connecting with the viewer.
     * @param msg A message from the viewer in JSON fromat.
     */
    handler(websocket, msg) {
        const data = JSON.parse(msg);
        if (data.type !== 'ping') {
            this.extension.logger.addLogMessage(`Handle data type: ${data.type}`);
        }
        switch (data.type) {
            case 'open': {
                const clients = this.getClients(data.path);
                if (clients === undefined) {
                    return;
                }
                const client = new Client(data.viewer, websocket);
                clients.add(client);
                websocket.on('close', () => {
                    clients.delete(client);
                });
                break;
            }
            case 'request_params': {
                const clients = this.getClients(data.path);
                if (!clients) {
                    break;
                }
                for (const client of clients) {
                    if (client.websocket !== websocket) {
                        continue;
                    }
                    const configuration = vscode.workspace.getConfiguration('latex-workshop');
                    const invertType = configuration.get('view.pdf.invertMode.enabled');
                    const invertEnabled = (invertType === 'auto' && (theme_1.getCurrentThemeLightness() === 'dark')) ||
                        invertType === 'always' ||
                        (invertType === 'compat' && (configuration.get('view.pdf.invert') > 0));
                    const pack = {
                        type: 'params',
                        scale: configuration.get('view.pdf.zoom'),
                        trim: configuration.get('view.pdf.trim'),
                        scrollMode: configuration.get('view.pdf.scrollMode'),
                        spreadMode: configuration.get('view.pdf.spreadMode'),
                        hand: configuration.get('view.pdf.hand'),
                        invertMode: {
                            enabled: invertEnabled,
                            brightness: configuration.get('view.pdf.invertMode.brightness'),
                            grayscale: configuration.get('view.pdf.invertMode.grayscale'),
                            hueRotate: configuration.get('view.pdf.invertMode.hueRotate'),
                            invert: configuration.get('view.pdf.invert'),
                            sepia: configuration.get('view.pdf.invertMode.sepia'),
                        },
                        bgColor: configuration.get('view.pdf.backgroundColor'),
                        keybindings: {
                            synctex: configuration.get('view.pdf.internal.synctex.keybinding')
                        }
                    };
                    this.extension.logger.addLogMessage(`Sending the settings of the PDF viewer for initialization: ${JSON.stringify(pack)}`);
                    client.send(pack);
                }
                break;
            }
            case 'loaded': {
                const configuration = vscode.workspace.getConfiguration('latex-workshop');
                if (configuration.get('synctex.afterBuild.enabled')) {
                    this.extension.logger.addLogMessage('SyncTex after build invoked.');
                    this.extension.locator.syncTeX(undefined, undefined, decodeURIComponent(data.path));
                }
                break;
            }
            case 'reverse_synctex': {
                void this.extension.locator.locate(data, data.path);
                break;
            }
            case 'ping': {
                // nothing to do
                break;
            }
            case 'add_log': {
                this.extension.logger.addLogMessage(`[PDF Viewer] ${data.message}`);
                break;
            }
            default: {
                this.extension.logger.addLogMessage(`Unknown websocket message: ${msg}`);
                break;
            }
        }
    }
    /**
     * Reveals the position of `record` on the internal PDF viewers.
     *
     * @param pdfFile The path of a PDF file.
     * @param record The position to be revealed.
     */
    syncTeX(pdfFile, record) {
        const clients = this.getClients(pdfFile);
        if (clients === undefined) {
            this.extension.logger.addLogMessage(`PDF is not viewed: ${pdfFile}`);
            return;
        }
        const needDelay = this.revealWebviewPanel(pdfFile);
        for (const client of clients) {
            setTimeout(() => {
                client.send({ type: 'synctex', data: record });
            }, needDelay ? 200 : 0);
            this.extension.logger.addLogMessage(`Try to synctex ${pdfFile}`);
        }
    }
    /**
     * Reveals the internal PDF viewer of `pdfFilePath`.
     * The first one is revealed.
     *
     * @param pdfFilePath The path of a PDF file.
     * @returns Returns `true` if `WebviewPanel.reveal` called.
     */
    revealWebviewPanel(pdfFilePath) {
        var _a;
        const panelSet = this.getPanelSet(pdfFilePath);
        if (!panelSet) {
            return;
        }
        for (const panel of panelSet.values()) {
            const isSyntexOn = !panel.state || panel.state.synctexEnabled;
            if (panel.webviewPanel.visible && isSyntexOn) {
                return;
            }
        }
        const activeViewColumn = (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.viewColumn;
        for (const panel of panelSet.values()) {
            if (panel.webviewPanel.viewColumn !== activeViewColumn) {
                const isSyntexOn = !panel.state || panel.state.synctexEnabled;
                if (!panel.webviewPanel.visible && isSyntexOn) {
                    panel.webviewPanel.reveal(undefined, true);
                    return true;
                }
                return;
            }
        }
        return;
    }
    /**
     * Returns the state of the internal PDF viewer of `pdfFilePath`.
     *
     * @param pdfFilePath The path of a PDF file.
     */
    getViewerState(pdfFilePath) {
        const panelSet = this.getPanelSet(pdfFilePath);
        if (!panelSet) {
            return [];
        }
        return Array.from(panelSet).map(e => e.state);
    }
}
exports.Viewer = Viewer;
//# sourceMappingURL=viewer.js.map