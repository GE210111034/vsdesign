"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerResourceDropOrPasteSupport = registerResourceDropOrPasteSupport;
const vscode = require("vscode");
const arrays_1 = require("../../util/arrays");
const document_1 = require("../../util/document");
const mimes_1 = require("../../util/mimes");
const schemes_1 = require("../../util/schemes");
const newFilePathGenerator_1 = require("./newFilePathGenerator");
const shared_1 = require("./shared");
const smartDropOrPaste_1 = require("./smartDropOrPaste");
const uriList_1 = require("../../util/uriList");
var CopyFilesSettings;
(function (CopyFilesSettings) {
    CopyFilesSettings["Never"] = "never";
    CopyFilesSettings["MediaFiles"] = "mediaFiles";
})(CopyFilesSettings || (CopyFilesSettings = {}));
/**
 * Provides support for pasting or dropping resources into markdown documents.
 *
 * This includes:
 *
 * - `text/uri-list` data in the data transfer.
 * - File object in the data transfer.
 * - Media data in the data transfer, such as `image/png`.
 */
class ResourcePasteOrDropProvider {
    constructor(_parser) {
        this._parser = _parser;
        this._yieldTo = [
            vscode.DocumentDropOrPasteEditKind.Empty.append('text'),
            vscode.DocumentDropOrPasteEditKind.Empty.append('markdown', 'image', 'attachment'),
        ];
    }
    async provideDocumentDropEdits(document, position, dataTransfer, token) {
        const edit = await this._createEdit(document, [new vscode.Range(position, position)], dataTransfer, {
            insert: this._getEnabled(document, 'editor.drop.enabled'),
            copyIntoWorkspace: vscode.workspace.getConfiguration('markdown', document).get('editor.drop.copyIntoWorkspace', CopyFilesSettings.MediaFiles)
        }, undefined, token);
        if (!edit || token.isCancellationRequested) {
            return;
        }
        const dropEdit = new vscode.DocumentDropEdit(edit.snippet);
        dropEdit.title = edit.label;
        dropEdit.kind = ResourcePasteOrDropProvider.kind;
        dropEdit.additionalEdit = edit.additionalEdits;
        dropEdit.yieldTo = [...this._yieldTo, ...edit.yieldTo];
        return dropEdit;
    }
    async provideDocumentPasteEdits(document, ranges, dataTransfer, context, token) {
        const edit = await this._createEdit(document, ranges, dataTransfer, {
            insert: this._getEnabled(document, 'editor.paste.enabled'),
            copyIntoWorkspace: vscode.workspace.getConfiguration('markdown', document).get('editor.paste.copyIntoWorkspace', CopyFilesSettings.MediaFiles)
        }, context, token);
        if (!edit || token.isCancellationRequested) {
            return;
        }
        const pasteEdit = new vscode.DocumentPasteEdit(edit.snippet, edit.label, ResourcePasteOrDropProvider.kind);
        pasteEdit.additionalEdit = edit.additionalEdits;
        pasteEdit.yieldTo = [...this._yieldTo, ...edit.yieldTo];
        return [pasteEdit];
    }
    _getEnabled(document, settingName) {
        const setting = vscode.workspace.getConfiguration('markdown', document).get(settingName, true);
        // Convert old boolean values to new enum setting
        if (setting === false) {
            return smartDropOrPaste_1.InsertMarkdownLink.Never;
        }
        else if (setting === true) {
            return smartDropOrPaste_1.InsertMarkdownLink.Smart;
        }
        else {
            return setting;
        }
    }
    async _createEdit(document, ranges, dataTransfer, settings, context, token) {
        if (settings.insert === smartDropOrPaste_1.InsertMarkdownLink.Never) {
            return;
        }
        let edit = await this._createEditForMediaFiles(document, dataTransfer, settings.copyIntoWorkspace, token);
        if (token.isCancellationRequested) {
            return;
        }
        if (!edit) {
            edit = await this._createEditFromUriListData(document, ranges, dataTransfer, context, token);
        }
        if (!edit || token.isCancellationRequested) {
            return;
        }
        if (!(await (0, smartDropOrPaste_1.shouldInsertMarkdownLinkByDefault)(this._parser, document, settings.insert, ranges, token))) {
            edit.yieldTo.push(vscode.DocumentDropOrPasteEditKind.Empty.append('uri'));
        }
        return edit;
    }
    async _createEditFromUriListData(document, ranges, dataTransfer, context, token) {
        const uriListData = await dataTransfer.get(mimes_1.Mime.textUriList)?.asString();
        if (!uriListData || token.isCancellationRequested) {
            return;
        }
        const uriList = uriList_1.UriList.from(uriListData);
        if (!uriList.entries.length) {
            return;
        }
        // In some browsers, copying from the address bar sets both text/uri-list and text/plain.
        // Disable ourselves if there's also a text entry with the same http(s) uri as our list,
        // unless we are explicitly requested.
        if (uriList.entries.length === 1
            && (uriList.entries[0].uri.scheme === schemes_1.Schemes.http || uriList.entries[0].uri.scheme === schemes_1.Schemes.https)
            && !context?.only?.contains(ResourcePasteOrDropProvider.kind)) {
            const text = await dataTransfer.get(mimes_1.Mime.textPlain)?.asString();
            if (token.isCancellationRequested) {
                return;
            }
            if (text && textMatchesUriList(text, uriList)) {
                return;
            }
        }
        const edit = (0, shared_1.createInsertUriListEdit)(document, ranges, uriList);
        if (!edit) {
            return;
        }
        const additionalEdits = new vscode.WorkspaceEdit();
        additionalEdits.set(document.uri, edit.edits);
        return {
            label: edit.label,
            snippet: new vscode.SnippetString(''),
            additionalEdits,
            yieldTo: []
        };
    }
    /**
     * Create a new edit for media files in a data transfer.
     *
     * This tries copying files outside of the workspace into the workspace.
     */
    async _createEditForMediaFiles(document, dataTransfer, copyIntoWorkspace, token) {
        if (copyIntoWorkspace !== CopyFilesSettings.MediaFiles || (0, document_1.getParentDocumentUri)(document.uri).scheme === schemes_1.Schemes.untitled) {
            return;
        }
        const pathGenerator = new newFilePathGenerator_1.NewFilePathGenerator();
        const fileEntries = (0, arrays_1.coalesce)(await Promise.all(Array.from(dataTransfer, async ([mime, item]) => {
            if (!mimes_1.mediaMimes.has(mime)) {
                return;
            }
            const file = item?.asFile();
            if (!file) {
                return;
            }
            if (file.uri) {
                // If the file is already in a workspace, we don't want to create a copy of it
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(file.uri);
                if (workspaceFolder) {
                    return { uri: file.uri };
                }
            }
            const newFile = await pathGenerator.getNewFilePath(document, file, token);
            if (!newFile) {
                return;
            }
            return { uri: newFile.uri, newFile: { contents: file, overwrite: newFile.overwrite } };
        })));
        if (!fileEntries.length) {
            return;
        }
        const snippet = (0, shared_1.createUriListSnippet)(document.uri, fileEntries);
        if (!snippet) {
            return;
        }
        const additionalEdits = new vscode.WorkspaceEdit();
        for (const entry of fileEntries) {
            if (entry.newFile) {
                additionalEdits.createFile(entry.uri, {
                    contents: entry.newFile.contents,
                    overwrite: entry.newFile.overwrite,
                });
            }
        }
        return {
            snippet: snippet.snippet,
            label: (0, shared_1.getSnippetLabel)(snippet),
            additionalEdits,
            yieldTo: [],
        };
    }
}
ResourcePasteOrDropProvider.kind = vscode.DocumentDropOrPasteEditKind.Empty.append('markdown', 'link');
ResourcePasteOrDropProvider.mimeTypes = [
    mimes_1.Mime.textUriList,
    'files',
    ...mimes_1.mediaMimes,
];
function textMatchesUriList(text, uriList) {
    if (text === uriList.entries[0].str) {
        return true;
    }
    try {
        const uri = vscode.Uri.parse(text);
        return uriList.entries.some(entry => entry.uri.toString() === uri.toString());
    }
    catch {
        return false;
    }
}
function registerResourceDropOrPasteSupport(selector, parser) {
    return vscode.Disposable.from(vscode.languages.registerDocumentPasteEditProvider(selector, new ResourcePasteOrDropProvider(parser), {
        providedPasteEditKinds: [ResourcePasteOrDropProvider.kind],
        pasteMimeTypes: ResourcePasteOrDropProvider.mimeTypes,
    }), vscode.languages.registerDocumentDropEditProvider(selector, new ResourcePasteOrDropProvider(parser), {
        providedDropEditKinds: [ResourcePasteOrDropProvider.kind],
        dropMimeTypes: ResourcePasteOrDropProvider.mimeTypes,
    }));
}
//# sourceMappingURL=dropOrPasteResource.js.map