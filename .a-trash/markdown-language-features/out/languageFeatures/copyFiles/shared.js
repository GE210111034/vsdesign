"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaFileExtensions = void 0;
exports.getSnippetLabel = getSnippetLabel;
exports.createInsertUriListEdit = createInsertUriListEdit;
exports.createUriListSnippet = createUriListSnippet;
const path = require("path");
const vscode = require("vscode");
const URI = require("vscode-uri");
const document_1 = require("../../util/document");
const schemes_1 = require("../../util/schemes");
const snippets_1 = require("./snippets");
var MediaKind;
(function (MediaKind) {
    MediaKind[MediaKind["Image"] = 0] = "Image";
    MediaKind[MediaKind["Video"] = 1] = "Video";
    MediaKind[MediaKind["Audio"] = 2] = "Audio";
})(MediaKind || (MediaKind = {}));
exports.mediaFileExtensions = new Map([
    // Images
    ['avif', MediaKind.Image],
    ['bmp', MediaKind.Image],
    ['gif', MediaKind.Image],
    ['ico', MediaKind.Image],
    ['jpe', MediaKind.Image],
    ['jpeg', MediaKind.Image],
    ['jpg', MediaKind.Image],
    ['png', MediaKind.Image],
    ['psd', MediaKind.Image],
    ['svg', MediaKind.Image],
    ['tga', MediaKind.Image],
    ['tif', MediaKind.Image],
    ['tiff', MediaKind.Image],
    ['webp', MediaKind.Image],
    // Videos
    ['ogg', MediaKind.Video],
    ['mp4', MediaKind.Video],
    // Audio Files
    ['mp3', MediaKind.Audio],
    ['aac', MediaKind.Audio],
    ['wav', MediaKind.Audio],
]);
function getSnippetLabel(counter) {
    if (counter.insertedAudioVideoCount > 0) {
        if (counter.insertedLinkCount > 0) {
            return vscode.l10n.t('Insert Markdown Media and Links');
        }
        else {
            return vscode.l10n.t('Insert Markdown Media');
        }
    }
    else if (counter.insertedImageCount > 0 && counter.insertedLinkCount > 0) {
        return vscode.l10n.t('Insert Markdown Images and Links');
    }
    else if (counter.insertedImageCount > 0) {
        return counter.insertedImageCount > 1
            ? vscode.l10n.t('Insert Markdown Images')
            : vscode.l10n.t('Insert Markdown Image');
    }
    else {
        return counter.insertedLinkCount > 1
            ? vscode.l10n.t('Insert Markdown Links')
            : vscode.l10n.t('Insert Markdown Link');
    }
}
function createInsertUriListEdit(document, ranges, urlList, options) {
    if (!ranges.length || !urlList.entries.length) {
        return;
    }
    const edits = [];
    let insertedLinkCount = 0;
    let insertedImageCount = 0;
    let insertedAudioVideoCount = 0;
    // Use 1 for all empty ranges but give non-empty range unique indices starting after 1
    let placeHolderStartIndex = 1 + urlList.entries.length;
    // Sort ranges by start position
    const orderedRanges = [...ranges].sort((a, b) => a.start.compareTo(b.start));
    const allRangesAreEmpty = orderedRanges.every(range => range.isEmpty);
    for (const range of orderedRanges) {
        const snippet = createUriListSnippet(document.uri, urlList.entries, {
            placeholderText: range.isEmpty ? undefined : document.getText(range),
            placeholderStartIndex: allRangesAreEmpty ? 1 : placeHolderStartIndex,
            ...options,
        });
        if (!snippet) {
            continue;
        }
        insertedLinkCount += snippet.insertedLinkCount;
        insertedImageCount += snippet.insertedImageCount;
        insertedAudioVideoCount += snippet.insertedAudioVideoCount;
        placeHolderStartIndex += urlList.entries.length;
        edits.push(new vscode.SnippetTextEdit(range, snippet.snippet));
    }
    const label = getSnippetLabel({ insertedAudioVideoCount, insertedImageCount, insertedLinkCount });
    return { edits, label };
}
function createUriListSnippet(document, uris, options) {
    if (!uris.length) {
        return;
    }
    const documentDir = (0, document_1.getDocumentDir)(document);
    const config = vscode.workspace.getConfiguration('markdown', document);
    const title = options?.placeholderText || 'Title';
    let insertedLinkCount = 0;
    let insertedImageCount = 0;
    let insertedAudioVideoCount = 0;
    const snippet = new vscode.SnippetString();
    let placeholderIndex = options?.placeholderStartIndex ?? 1;
    uris.forEach((uri, i) => {
        const mdPath = (!options?.preserveAbsoluteUris ? getRelativeMdPath(documentDir, uri.uri) : undefined) ?? uri.str ?? uri.uri.toString();
        const ext = URI.Utils.extname(uri.uri).toLowerCase().replace('.', '');
        const insertAsMedia = options?.insertAsMedia || (typeof options?.insertAsMedia === 'undefined' && exports.mediaFileExtensions.has(ext));
        if (insertAsMedia) {
            const insertAsVideo = exports.mediaFileExtensions.get(ext) === MediaKind.Video;
            const insertAsAudio = exports.mediaFileExtensions.get(ext) === MediaKind.Audio;
            if (insertAsVideo || insertAsAudio) {
                insertedAudioVideoCount++;
                const mediaSnippet = insertAsVideo
                    ? config.get('editor.filePaste.videoSnippet', '<video controls src="${src}" title="${title}"></video>')
                    : config.get('editor.filePaste.audioSnippet', '<audio controls src="${src}" title="${title}"></audio>');
                snippet.value += (0, snippets_1.resolveSnippet)(mediaSnippet, new Map([
                    ['src', mdPath],
                    ['title', `\${${placeholderIndex++}:${title}}`],
                ]));
            }
            else {
                insertedImageCount++;
                snippet.appendText('![');
                const placeholderText = escapeBrackets(options?.placeholderText || 'alt text');
                snippet.appendPlaceholder(placeholderText, placeholderIndex);
                snippet.appendText(`](${escapeMarkdownLinkPath(mdPath)})`);
            }
        }
        else {
            insertedLinkCount++;
            snippet.appendText('[');
            snippet.appendPlaceholder(escapeBrackets(options?.placeholderText ?? 'text'), placeholderIndex);
            snippet.appendText(`](${escapeMarkdownLinkPath(mdPath)})`);
        }
        if (i < uris.length - 1 && uris.length > 1) {
            snippet.appendText(options?.separator ?? ' ');
        }
    });
    return { snippet, insertedAudioVideoCount, insertedImageCount, insertedLinkCount };
}
function getRelativeMdPath(dir, file) {
    if (dir && dir.scheme === file.scheme && dir.authority === file.authority) {
        if (file.scheme === schemes_1.Schemes.file) {
            // On windows, we must use the native `path.relative` to generate the relative path
            // so that drive-letters are resolved cast insensitively. However we then want to
            // convert back to a posix path to insert in to the document.
            const relativePath = path.relative(dir.fsPath, file.fsPath);
            return path.posix.normalize(relativePath.split(path.sep).join(path.posix.sep));
        }
        return path.posix.relative(dir.path, file.path);
    }
    return undefined;
}
function escapeMarkdownLinkPath(mdPath) {
    if (needsBracketLink(mdPath)) {
        return '<' + mdPath.replaceAll('<', '\\<').replaceAll('>', '\\>') + '>';
    }
    return mdPath;
}
function escapeBrackets(value) {
    value = value.replace(/[\[\]]/g, '\\$&'); // CodeQL [SM02383] The Markdown is fully sanitized after being rendered.
    return value;
}
function needsBracketLink(mdPath) {
    // Links with whitespace or control characters must be enclosed in brackets
    if (mdPath.startsWith('<') || /\s|[\u007F\u0000-\u001f]/.test(mdPath)) {
        return true;
    }
    // Check if the link has mis-matched parens
    if (!/[\(\)]/.test(mdPath)) {
        return false;
    }
    let previousChar = '';
    let nestingCount = 0;
    for (const char of mdPath) {
        if (char === '(' && previousChar !== '\\') {
            nestingCount++;
        }
        else if (char === ')' && previousChar !== '\\') {
            nestingCount--;
        }
        if (nestingCount < 0) {
            return true;
        }
        previousChar = char;
    }
    return nestingCount > 0;
}
//# sourceMappingURL=shared.js.map