"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const httpRequest = require("request-light");
const vscode = require("vscode");
const jsonContributions_1 = require("./features/jsonContributions");
const commands_1 = require("./commands");
const npmView_1 = require("./npmView");
const tasks_1 = require("./tasks");
const scriptHover_1 = require("./scriptHover");
const npmScriptLens_1 = require("./npmScriptLens");
const which = require("which");
let treeDataProvider;
function invalidateScriptCaches() {
    (0, scriptHover_1.invalidateHoverScriptsCache)();
    (0, tasks_1.invalidateTasksCache)();
    if (treeDataProvider) {
        treeDataProvider.refresh();
    }
}
async function activate(context) {
    configureHttpRequest();
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('http.proxy') || e.affectsConfiguration('http.proxyStrictSSL')) {
            configureHttpRequest();
        }
    }));
    const npmCommandPath = await getNPMCommandPath();
    context.subscriptions.push((0, jsonContributions_1.addJSONProviders)(httpRequest.xhr, npmCommandPath));
    registerTaskProvider(context);
    treeDataProvider = registerExplorer(context);
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('npm.exclude') || e.affectsConfiguration('npm.autoDetect') || e.affectsConfiguration('npm.scriptExplorerExclude')) {
            (0, tasks_1.invalidateTasksCache)();
            if (treeDataProvider) {
                treeDataProvider.refresh();
            }
        }
        if (e.affectsConfiguration('npm.scriptExplorerAction')) {
            if (treeDataProvider) {
                treeDataProvider.refresh();
            }
        }
    }));
    registerHoverProvider(context);
    context.subscriptions.push(vscode.commands.registerCommand('npm.runSelectedScript', commands_1.runSelectedScript));
    if (await (0, tasks_1.hasPackageJson)()) {
        vscode.commands.executeCommand('setContext', 'npm:showScriptExplorer', true);
    }
    context.subscriptions.push(vscode.commands.registerCommand('npm.runScriptFromFolder', commands_1.selectAndRunScriptFromFolder));
    context.subscriptions.push(vscode.commands.registerCommand('npm.refresh', () => {
        invalidateScriptCaches();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('npm.packageManager', (args) => {
        if (args instanceof vscode.Uri) {
            return (0, tasks_1.getPackageManager)(context, args);
        }
        return '';
    }));
    context.subscriptions.push(new npmScriptLens_1.NpmScriptLensProvider());
    context.subscriptions.push(vscode.window.registerTerminalQuickFixProvider('ms-vscode.npm-command', {
        provideTerminalQuickFixes({ outputMatch }) {
            if (!outputMatch) {
                return;
            }
            const lines = outputMatch.regexMatch[1];
            const fixes = [];
            for (const line of lines.split('\n')) {
                // search from the second char, since the lines might be prefixed with
                // "npm ERR!" which comes before the actual command suggestion.
                const begin = line.indexOf('npm', 1);
                if (begin === -1) {
                    continue;
                }
                const end = line.lastIndexOf('#');
                fixes.push({ terminalCommand: line.slice(begin, end === -1 ? undefined : end - 1) });
            }
            return fixes;
        },
    }));
}
async function getNPMCommandPath() {
    if (vscode.workspace.isTrusted && canRunNpmInCurrentWorkspace()) {
        try {
            return await which(process.platform === 'win32' ? 'npm.cmd' : 'npm');
        }
        catch (e) {
            return undefined;
        }
    }
    return undefined;
}
function canRunNpmInCurrentWorkspace() {
    if (vscode.workspace.workspaceFolders) {
        return vscode.workspace.workspaceFolders.some(f => f.uri.scheme === 'file');
    }
    return false;
}
let taskProvider;
function registerTaskProvider(context) {
    if (vscode.workspace.workspaceFolders) {
        const watcher = vscode.workspace.createFileSystemWatcher('**/package.json');
        watcher.onDidChange((_e) => invalidateScriptCaches());
        watcher.onDidDelete((_e) => invalidateScriptCaches());
        watcher.onDidCreate((_e) => invalidateScriptCaches());
        context.subscriptions.push(watcher);
        const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders((_e) => invalidateScriptCaches());
        context.subscriptions.push(workspaceWatcher);
        taskProvider = new tasks_1.NpmTaskProvider(context);
        const disposable = vscode.tasks.registerTaskProvider('npm', taskProvider);
        context.subscriptions.push(disposable);
        return disposable;
    }
    return undefined;
}
function registerExplorer(context) {
    if (vscode.workspace.workspaceFolders) {
        const treeDataProvider = new npmView_1.NpmScriptsTreeDataProvider(context, taskProvider);
        const view = vscode.window.createTreeView('npm', { treeDataProvider: treeDataProvider, showCollapseAll: true });
        context.subscriptions.push(view);
        return treeDataProvider;
    }
    return undefined;
}
function registerHoverProvider(context) {
    if (vscode.workspace.workspaceFolders) {
        const npmSelector = {
            language: 'json',
            scheme: 'file',
            pattern: '**/package.json'
        };
        const provider = new scriptHover_1.NpmScriptHoverProvider(context);
        context.subscriptions.push(vscode.languages.registerHoverProvider(npmSelector, provider));
        return provider;
    }
    return undefined;
}
function configureHttpRequest() {
    const httpSettings = vscode.workspace.getConfiguration('http');
    httpRequest.configure(httpSettings.get('proxy', ''), httpSettings.get('proxyStrictSSL', true));
}
function deactivate() {
}
//# sourceMappingURL=npmMain.js.map