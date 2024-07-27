"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPasteUrlSupport = registerPasteUrlSupport;
const vscode = require("vscode");
const mimes_1 = require("../../util/mimes");
const shared_1 = require("./shared");
const smartDropOrPaste_1 = require("./smartDropOrPaste");
const uriList_1 = require("../../util/uriList");
/**
 * Adds support for pasting text uris to create markdown links.
 *
 * This only applies to `text/plain`. Other mimes like `text/uri-list` are handled by ResourcePasteOrDropProvider.
 */
class PasteUrlEditProvider {
    constructor(_parser) {
        this._parser = _parser;
    }
    async provideDocumentPasteEdits(document, ranges, dataTransfer, _context, token) {
        const pasteUrlSetting = vscode.workspace.getConfiguration('markdown', document)
            .get('editor.pasteUrlAsFormattedLink.enabled', smartDropOrPaste_1.InsertMarkdownLink.SmartWithSelection);
        if (pasteUrlSetting === smartDropOrPaste_1.InsertMarkdownLink.Never) {
            return;
        }
        const item = dataTransfer.get(mimes_1.Mime.textPlain);
        const text = await item?.asString();
        if (token.isCancellationRequested || !text) {
            return;
        }
        const uriText = (0, smartDropOrPaste_1.findValidUriInText)(text);
        if (!uriText) {
            return;
        }
        const edit = (0, shared_1.createInsertUriListEdit)(document, ranges, uriList_1.UriList.from(uriText), { preserveAbsoluteUris: true });
        if (!edit) {
            return;
        }
        const pasteEdit = new vscode.DocumentPasteEdit('', edit.label, PasteUrlEditProvider.kind);
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.set(document.uri, edit.edits);
        pasteEdit.additionalEdit = workspaceEdit;
        if (!(await (0, smartDropOrPaste_1.shouldInsertMarkdownLinkByDefault)(this._parser, document, pasteUrlSetting, ranges, token))) {
            pasteEdit.yieldTo = [
                vscode.DocumentDropOrPasteEditKind.Empty.append('text'),
                vscode.DocumentDropOrPasteEditKind.Empty.append('uri')
            ];
        }
        return [pasteEdit];
    }
}
PasteUrlEditProvider.kind = vscode.DocumentDropOrPasteEditKind.Empty.append('markdown', 'link');
PasteUrlEditProvider.pasteMimeTypes = [mimes_1.Mime.textPlain];
function registerPasteUrlSupport(selector, parser) {
    return vscode.languages.registerDocumentPasteEditProvider(selector, new PasteUrlEditProvider(parser), {
        providedPasteEditKinds: [PasteUrlEditProvider.kind],
        pasteMimeTypes: PasteUrlEditProvider.pasteMimeTypes,
    });
}
//# sourceMappingURL=pasteUrlProvider.js.map