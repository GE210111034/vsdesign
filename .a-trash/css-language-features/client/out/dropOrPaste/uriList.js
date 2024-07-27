"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.UriList = void 0;
const vscode = require("vscode");
function splitUriList(str) {
    return str.split('\r\n');
}
function parseUriList(str) {
    return splitUriList(str)
        .filter(value => !value.startsWith('#')) // Remove comments
        .map(value => value.trim());
}
class UriList {
    static from(str) {
        return new UriList(coalesce(parseUriList(str).map(line => {
            try {
                return { uri: vscode.Uri.parse(line), str: line };
            }
            catch {
                // Uri parse failure
                return undefined;
            }
        })));
    }
    constructor(entries) {
        this.entries = entries;
    }
}
exports.UriList = UriList;
function coalesce(array) {
    return array.filter(e => !!e);
}
//# sourceMappingURL=uriList.js.map