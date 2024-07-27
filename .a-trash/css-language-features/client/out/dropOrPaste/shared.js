"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mimes = exports.Schemes = void 0;
exports.getDocumentDir = getDocumentDir;
const vscode = require("vscode");
const vscode_uri_1 = require("vscode-uri");
exports.Schemes = Object.freeze({
    file: 'file',
    notebookCell: 'vscode-notebook-cell',
    untitled: 'untitled',
});
exports.Mimes = Object.freeze({
    plain: 'text/plain',
    uriList: 'text/uri-list',
});
function getDocumentDir(uri) {
    const docUri = getParentDocumentUri(uri);
    if (docUri.scheme === exports.Schemes.untitled) {
        return vscode.workspace.workspaceFolders?.[0]?.uri;
    }
    return vscode_uri_1.Utils.dirname(docUri);
}
function getParentDocumentUri(uri) {
    if (uri.scheme === exports.Schemes.notebookCell) {
        // is notebook documents necessary?
        for (const notebook of vscode.workspace.notebookDocuments) {
            for (const cell of notebook.getCells()) {
                if (cell.document.uri.toString() === uri.toString()) {
                    return notebook.uri;
                }
            }
        }
    }
    return uri;
}
//# sourceMappingURL=shared.js.map