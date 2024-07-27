"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCopyFileConfiguration = getCopyFileConfiguration;
exports.parseGlob = parseGlob;
exports.resolveCopyDestination = resolveCopyDestination;
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const path = require("path");
const vscode = require("vscode");
const vscode_uri_1 = require("vscode-uri");
function getCopyFileConfiguration(document) {
    const config = vscode.workspace.getConfiguration('markdown', document);
    return {
        destination: config.get('copyFiles.destination') ?? {},
        overwriteBehavior: readOverwriteBehavior(config),
    };
}
function readOverwriteBehavior(config) {
    switch (config.get('copyFiles.overwriteBehavior')) {
        case 'overwrite': return 'overwrite';
        default: return 'nameIncrementally';
    }
}
function parseGlob(rawGlob) {
    if (rawGlob.startsWith('/')) {
        // Anchor to workspace folders
        return (vscode.workspace.workspaceFolders ?? []).map(folder => vscode.Uri.joinPath(folder.uri, rawGlob).path);
    }
    // Relative path, so implicitly track on ** to match everything
    if (!rawGlob.startsWith('**')) {
        return ['**/' + rawGlob];
    }
    return [rawGlob];
}
function resolveCopyDestination(documentUri, fileName, dest, getWorkspaceFolder) {
    const resolvedDest = resolveCopyDestinationSetting(documentUri, fileName, dest, getWorkspaceFolder);
    if (resolvedDest.startsWith('/')) {
        // Absolute path
        return vscode_uri_1.Utils.resolvePath(documentUri, resolvedDest);
    }
    // Relative to document
    const dirName = vscode_uri_1.Utils.dirname(documentUri);
    return vscode_uri_1.Utils.resolvePath(dirName, resolvedDest);
}
function resolveCopyDestinationSetting(documentUri, fileName, dest, getWorkspaceFolder) {
    let outDest = dest.trim();
    if (!outDest) {
        outDest = '${fileName}';
    }
    // Destination that start with `/` implicitly means go to workspace root
    if (outDest.startsWith('/')) {
        outDest = '${documentWorkspaceFolder}/' + outDest.slice(1);
    }
    // Destination that ends with `/` implicitly needs a fileName
    if (outDest.endsWith('/')) {
        outDest += '${fileName}';
    }
    const documentDirName = vscode_uri_1.Utils.dirname(documentUri);
    const documentBaseName = vscode_uri_1.Utils.basename(documentUri);
    const documentExtName = vscode_uri_1.Utils.extname(documentUri);
    const workspaceFolder = getWorkspaceFolder(documentUri);
    const vars = new Map([
        // Document
        ['documentDirName', documentDirName.path], // Absolute parent directory path of the Markdown document, e.g. `/Users/me/myProject/docs`.
        ['documentRelativeDirName', workspaceFolder ? path.posix.relative(workspaceFolder.path, documentDirName.path) : documentDirName.path], // Relative parent directory path of the Markdown document, e.g. `docs`. This is the same as `${documentDirName}` if the file is not part of a workspace.
        ['documentFileName', documentBaseName], // The full filename of the Markdown document, e.g. `README.md`.
        ['documentBaseName', documentBaseName.slice(0, documentBaseName.length - documentExtName.length)], // The basename of the Markdown document, e.g. `README`.
        ['documentExtName', documentExtName.replace('.', '')], // The extension of the Markdown document, e.g. `md`.
        ['documentFilePath', documentUri.path], // Absolute path of the Markdown document, e.g. `/Users/me/myProject/docs/README.md`.
        ['documentRelativeFilePath', workspaceFolder ? path.posix.relative(workspaceFolder.path, documentUri.path) : documentUri.path], // Relative path of the Markdown document, e.g. `docs/README.md`. This is the same as `${documentFilePath}` if the file is not part of a workspace.
        // Workspace
        ['documentWorkspaceFolder', ((workspaceFolder ?? documentDirName).path)], // The workspace folder for the Markdown document, e.g. `/Users/me/myProject`. This is the same as `${documentDirName}` if the file is not part of a workspace.
        // File
        ['fileName', fileName], // The file name of the dropped file, e.g. `image.png`.
        ['fileExtName', path.extname(fileName).replace('.', '')], // The extension of the dropped file, e.g. `png`.
    ]);
    return outDest.replaceAll(/(?<escape>\\\$)|(?<!\\)\$\{(?<name>\w+)(?:\/(?<pattern>(?:\\\/|[^\}\/])+)\/(?<replacement>(?:\\\/|[^\}\/])*)\/)?\}/g, (match, _escape, name, pattern, replacement, _offset, _str, groups) => {
        if (groups?.['escape']) {
            return '$';
        }
        const entry = vars.get(name);
        if (typeof entry !== 'string') {
            return match;
        }
        if (pattern && replacement) {
            try {
                return entry.replace(new RegExp(replaceTransformEscapes(pattern)), replaceTransformEscapes(replacement));
            }
            catch (e) {
                console.log(`Error applying 'resolveCopyDestinationSetting' transform: ${pattern} -> ${replacement}`);
            }
        }
        return entry;
    });
}
function replaceTransformEscapes(str) {
    return str.replaceAll(/\\\//g, '/');
}
//# sourceMappingURL=copyFiles.js.map