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
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
const domstubs = __importStar(require("@tamuratak/domstubs"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const pdfjsLib = __importStar(require("pdfjs-dist/es5/build/pdf"));
const workerpool = __importStar(require("workerpool"));
domstubs.setStubs(global);
class NodeCMapReaderFactory {
    constructor() {
        this.cmapDir = path.join(__dirname, '../../../../node_modules/pdfjs-dist/cmaps/');
    }
    fetch(arg) {
        const name = arg.name;
        if (!name) {
            return Promise.reject(new Error('CMap name must be specified.'));
        }
        const file = this.cmapDir + name + '.bcmap';
        const data = fs.readFileSync(file);
        return Promise.resolve({
            cMapData: new Uint8Array(data),
            compressionType: 1
        });
    }
}
async function renderToSvg(pdfPath, options) {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({
        data,
        fontExtraProperties: true,
        CMapReaderFactory: NodeCMapReaderFactory
    });
    const doc = await loadingTask.promise;
    const page = await doc.getPage(options.pageNumber);
    let viewport = page.getViewport({ scale: 1.0, });
    const height = options.height;
    const width = options.width;
    const scale = Math.min(height / viewport.height, width / viewport.width, 1);
    viewport = page.getViewport({ scale });
    const opList = await page.getOperatorList();
    const svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
    svgGfx.embedFonts = true;
    const svg = await svgGfx.getSVG(opList, viewport);
    return svg.toString();
}
const workers = { renderToSvg };
workerpool.worker(workers);
//# sourceMappingURL=pdfrenderer_worker.js.map