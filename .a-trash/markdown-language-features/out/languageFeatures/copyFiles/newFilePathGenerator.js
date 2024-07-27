"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewFilePathGenerator = void 0;
exports.getDesiredNewFilePath = getDesiredNewFilePath;
const picomatch = require("picomatch");
const vscode = require("vscode");
const vscode_uri_1 = require("vscode-uri");
const document_1 = require("../../util/document");
const copyFiles_1 = require("./copyFiles");
class NewFilePathGenerator {
    constructor() {
        this._usedPaths = new Set();
    }
    async getNewFilePath(document, file, token) {
        const config = (0, copyFiles_1.getCopyFileConfiguration)(document);
        const desiredPath = getDesiredNewFilePath(config, document, file);
        const root = vscode_uri_1.Utils.dirname(desiredPath);
        const ext = vscode_uri_1.Utils.extname(desiredPath);
        let baseName = vscode_uri_1.Utils.basename(desiredPath);
        baseName = baseName.slice(0, baseName.length - ext.length);
        for (let i = 0;; ++i) {
            if (token.isCancellationRequested) {
                return undefined;
            }
            const name = i === 0 ? baseName : `${baseName}-${i}`;
            const uri = vscode.Uri.joinPath(root, name + ext);
            if (this._wasPathAlreadyUsed(uri)) {
                continue;
            }
            // Try overwriting if it already exists
            if (config.overwriteBehavior === 'overwrite') {
                this._usedPaths.add(uri.toString());
                return { uri, overwrite: true };
            }
            // Otherwise we need to check the fs to see if it exists
            try {
                await vscode.workspace.fs.stat(uri);
            }
            catch {
                if (!this._wasPathAlreadyUsed(uri)) {
                    // Does not exist
                    this._usedPaths.add(uri.toString());
                    return { uri, overwrite: false };
                }
            }
        }
    }
    _wasPathAlreadyUsed(uri) {
        return this._usedPaths.has(uri.toString());
    }
}
exports.NewFilePathGenerator = NewFilePathGenerator;
function getDesiredNewFilePath(config, document, file) {
    const docUri = (0, document_1.getParentDocumentUri)(document.uri);
    for (const [rawGlob, rawDest] of Object.entries(config.destination)) {
        for (const glob of (0, copyFiles_1.parseGlob)(rawGlob)) {
            if (picomatch.isMatch(docUri.path, glob, { dot: true })) {
                return (0, copyFiles_1.resolveCopyDestination)(docUri, file.name, rawDest, uri => vscode.workspace.getWorkspaceFolder(uri)?.uri);
            }
        }
    }
    // Default to next to current file
    return vscode.Uri.joinPath(vscode_uri_1.Utils.dirname(docUri), file.name);
}
//# sourceMappingURL=newFilePathGenerator.js.map