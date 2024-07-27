"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDocumentDir = getDocumentDir;
exports.getParentDocumentUri = getParentDocumentUri;
const vscode = require("vscode");
const schemes_1 = require("./schemes");
const vscode_uri_1 = require("vscode-uri");
function getDocumentDir(uri) {
    const docUri = getParentDocumentUri(uri);
    if (docUri.scheme === schemes_1.Schemes.untitled) {
        return vscode.workspace.workspaceFolders?.[0]?.uri;
    }
    return vscode_uri_1.Utils.dirname(docUri);
}
function getParentDocumentUri(uri) {
    if (uri.scheme === schemes_1.Schemes.notebookCell) {
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
//# sourceMappingURL=document.js.map