"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
exports.register = register;
const vscode = __importStar(require("vscode"));
const typeConverters = __importStar(require("../typeConverters"));
const typescriptService_1 = require("../typescriptService");
const dependentRegistration_1 = require("./util/dependentRegistration");
const api_1 = require("../tsServer/api");
class CopyMetadata {
    constructor(resource, ranges) {
        this.resource = resource;
        this.ranges = ranges;
    }
    toJSON() {
        return JSON.stringify({
            resource: this.resource.toJSON(),
            ranges: this.ranges,
        });
    }
    static fromJSON(str) {
        try {
            const parsed = JSON.parse(str);
            return new CopyMetadata(vscode.Uri.from(parsed.resource), parsed.ranges.map((r) => new vscode.Range(r[0].line, r[0].character, r[1].line, r[1].character)));
        }
        catch {
            // ignore
        }
        return undefined;
    }
}
const settingId = 'experimental.updateImportsOnPaste';
class DocumentPasteProvider {
    constructor(_modeId, _client) {
        this._modeId = _modeId;
        this._client = _client;
    }
    prepareDocumentPaste(document, ranges, dataTransfer, _token) {
        dataTransfer.set(DocumentPasteProvider.metadataMimeType, new vscode.DataTransferItem(new CopyMetadata(document.uri, ranges).toJSON()));
    }
    async provideDocumentPasteEdits(document, ranges, dataTransfer, _context, token) {
        const config = vscode.workspace.getConfiguration(this._modeId, document.uri);
        if (!config.get(settingId, false)) {
            return;
        }
        const file = this._client.toOpenTsFilePath(document);
        if (!file) {
            return;
        }
        const text = await dataTransfer.get('text/plain')?.asString();
        if (!text || token.isCancellationRequested) {
            return;
        }
        // Get optional metadata
        const metadata = await this.extractMetadata(dataTransfer, token);
        if (token.isCancellationRequested) {
            return;
        }
        let copiedFrom;
        if (metadata) {
            const spans = metadata.ranges.map(typeConverters.Range.toTextSpan);
            const copyFile = this._client.toTsFilePath(metadata.resource);
            if (copyFile) {
                copiedFrom = { file: copyFile, spans };
            }
        }
        if (copiedFrom?.file === file) {
            return;
        }
        const response = await this._client.interruptGetErr(() => this._client.execute('getPasteEdits', {
            file,
            // TODO: only supports a single paste for now
            pastedText: [text],
            pasteLocations: ranges.map(typeConverters.Range.toTextSpan),
            copiedFrom
        }, token));
        if (response.type !== 'response' || !response.body?.edits.length || token.isCancellationRequested) {
            return;
        }
        const edit = new vscode.DocumentPasteEdit('', vscode.l10n.t("Paste with imports"), DocumentPasteProvider.kind);
        const additionalEdit = new vscode.WorkspaceEdit();
        for (const edit of response.body.edits) {
            additionalEdit.set(this._client.toResource(edit.fileName), edit.textChanges.map(typeConverters.TextEdit.fromCodeEdit));
        }
        edit.additionalEdit = additionalEdit;
        return [edit];
    }
    async extractMetadata(dataTransfer, token) {
        const metadata = await dataTransfer.get(DocumentPasteProvider.metadataMimeType)?.asString();
        if (token.isCancellationRequested) {
            return undefined;
        }
        return metadata ? CopyMetadata.fromJSON(metadata) : undefined;
    }
}
DocumentPasteProvider.kind = vscode.DocumentDropOrPasteEditKind.Empty.append('text', 'jsts', 'pasteWithImports');
DocumentPasteProvider.metadataMimeType = 'application/vnd.code.jsts.metadata';
function register(selector, language, client) {
    return (0, dependentRegistration_1.conditionalRegistration)([
        (0, dependentRegistration_1.requireSomeCapability)(client, typescriptService_1.ClientCapability.Semantic),
        (0, dependentRegistration_1.requireMinVersion)(client, api_1.API.v560),
        (0, dependentRegistration_1.requireGlobalConfiguration)(language.id, settingId),
    ], () => {
        return vscode.languages.registerDocumentPasteEditProvider(selector.semantic, new DocumentPasteProvider(language.id, client), {
            providedPasteEditKinds: [DocumentPasteProvider.kind],
            copyMimeTypes: [DocumentPasteProvider.metadataMimeType],
            pasteMimeTypes: ['text/plain'],
        });
    });
}
//# sourceMappingURL=copyPaste.js.map