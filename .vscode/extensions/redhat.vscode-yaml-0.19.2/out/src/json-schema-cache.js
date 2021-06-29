"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
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
exports.JSONSchemaCache = void 0;
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const CACHE_DIR = 'schemas_cache';
const CACHE_KEY = 'json-schema-key';
class JSONSchemaCache {
    constructor(globalStoragePath, memento, output) {
        this.memento = memento;
        this.output = output;
        this.isInitialized = false;
        this.cachePath = path.join(globalStoragePath, CACHE_DIR);
        this.cache = memento.get(CACHE_KEY, {});
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield fs.ensureDir(this.cachePath);
            const cachedFiles = yield fs.readdir(this.cachePath);
            // clean up memento if cached files was deleted from fs
            const cachedValues = cachedFiles.map((it) => path.join(this.cachePath, it));
            for (const key in this.cache) {
                if (Object.prototype.hasOwnProperty.call(this.cache, key)) {
                    const cacheEntry = this.cache[key];
                    if (!cachedValues.includes(cacheEntry.schemaPath)) {
                        delete this.cache[key];
                    }
                }
            }
            yield this.memento.update(CACHE_KEY, this.cache);
            this.isInitialized = true;
        });
    }
    getCacheFilePath(uri) {
        const hash = crypto.createHash('MD5');
        hash.update(uri);
        const hashedURI = hash.digest('hex');
        return path.join(this.cachePath, hashedURI);
    }
    getETag(schemaUri) {
        var _a;
        if (!this.isInitialized) {
            return undefined;
        }
        return (_a = this.cache[schemaUri]) === null || _a === void 0 ? void 0 : _a.eTag;
    }
    putSchema(schemaUri, eTag, schemaContent) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isInitialized) {
                yield this.init();
            }
            if (!this.cache[schemaUri]) {
                this.cache[schemaUri] = { eTag, schemaPath: this.getCacheFilePath(schemaUri) };
            }
            else {
                this.cache[schemaUri].eTag = eTag;
            }
            try {
                const cacheFile = this.cache[schemaUri].schemaPath;
                yield fs.writeFile(cacheFile, schemaContent);
                yield this.memento.update(CACHE_KEY, this.cache);
            }
            catch (err) {
                delete this.cache[schemaUri];
                this.output.appendLine(err);
            }
        });
    }
    getSchema(schemaUri) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isInitialized) {
                yield this.init();
            }
            const cacheFile = (_a = this.cache[schemaUri]) === null || _a === void 0 ? void 0 : _a.schemaPath;
            if (yield fs.pathExists(cacheFile)) {
                return yield fs.readFile(cacheFile, { encoding: 'UTF8' });
            }
            return undefined;
        });
    }
}
exports.JSONSchemaCache = JSONSchemaCache;
//# sourceMappingURL=json-schema-cache.js.map