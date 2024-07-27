"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryDocument = void 0;
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const vscode = require("vscode");
class InMemoryDocument {
    constructor(uri, contents, version = 0) {
        this.uri = uri;
        this.version = version;
        this._doc = vscode_languageserver_textdocument_1.TextDocument.create(this.uri.toString(), 'markdown', 0, contents);
    }
    getText(range) {
        return this._doc.getText(range);
    }
    positionAt(offset) {
        const pos = this._doc.positionAt(offset);
        return new vscode.Position(pos.line, pos.character);
    }
}
exports.InMemoryDocument = InMemoryDocument;
//# sourceMappingURL=inMemoryDocument.js.map