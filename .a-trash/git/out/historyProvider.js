"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHistoryProvider = void 0;
const vscode_1 = require("vscode");
const repository_1 = require("./repository");
const util_1 = require("./util");
const uri_1 = require("./uri");
const emoji_1 = require("./emoji");
const operation_1 = require("./operation");
class GitHistoryProvider {
    get currentHistoryItemGroup() { return this._currentHistoryItemGroup; }
    set currentHistoryItemGroup(value) {
        this._currentHistoryItemGroup = value;
        this._onDidChangeCurrentHistoryItemGroup.fire();
    }
    constructor(repository, logger) {
        this.repository = repository;
        this.logger = logger;
        this._onDidChangeCurrentHistoryItemGroup = new vscode_1.EventEmitter();
        this.onDidChangeCurrentHistoryItemGroup = this._onDidChangeCurrentHistoryItemGroup.event;
        this._onDidChangeDecorations = new vscode_1.EventEmitter();
        this.onDidChangeFileDecorations = this._onDidChangeDecorations.event;
        this.historyItemDecorations = new Map();
        this.historyItemLabels = new Map([
            ['HEAD -> refs/heads/', 'target'],
            ['refs/heads/', 'git-branch'],
            ['refs/remotes/', 'cloud'],
            ['refs/tags/', 'tag']
        ]);
        this.disposables = [];
        this.disposables.push(repository.onDidRunGitStatus(() => this.onDidRunGitStatus(), this));
        this.disposables.push((0, util_1.filterEvent)(repository.onDidRunOperation, e => e.operation === operation_1.Operation.Refresh)(() => this.onDidRunGitStatus(true), this));
        this.disposables.push(vscode_1.window.registerFileDecorationProvider(this));
    }
    async onDidRunGitStatus(force = false) {
        this.logger.trace('[GitHistoryProvider][onDidRunGitStatus] HEAD:', JSON.stringify(this._HEAD));
        this.logger.trace('[GitHistoryProvider][onDidRunGitStatus] repository.HEAD:', JSON.stringify(this.repository.HEAD));
        // Get the merge base of the current history item group
        const mergeBase = await this.resolveHEADMergeBase();
        // Check if HEAD has changed
        if (!force &&
            this._HEAD?.name === this.repository.HEAD?.name &&
            this._HEAD?.commit === this.repository.HEAD?.commit &&
            this._HEAD?.upstream?.name === this.repository.HEAD?.upstream?.name &&
            this._HEAD?.upstream?.remote === this.repository.HEAD?.upstream?.remote &&
            this._HEAD?.upstream?.commit === this.repository.HEAD?.upstream?.commit &&
            this._HEADMergeBase?.name === mergeBase?.name &&
            this._HEADMergeBase?.remote === mergeBase?.remote &&
            this._HEADMergeBase?.commit === mergeBase?.commit) {
            this.logger.trace('[GitHistoryProvider][onDidRunGitStatus] HEAD has not changed');
            return;
        }
        this._HEAD = this.repository.HEAD;
        this._HEADMergeBase = mergeBase;
        // Check if HEAD does not support incoming/outgoing (detached commit, tag)
        if (!this.repository.HEAD?.name || !this.repository.HEAD?.commit || this.repository.HEAD.type === 2 /* RefType.Tag */) {
            this.logger.trace('[GitHistoryProvider][onDidRunGitStatus] HEAD does not support incoming/outgoing');
            this.currentHistoryItemGroup = undefined;
            return;
        }
        this.currentHistoryItemGroup = {
            id: `refs/heads/${this.repository.HEAD.name ?? ''}`,
            name: this.repository.HEAD.name ?? '',
            revision: this.repository.HEAD.commit,
            remote: this.repository.HEAD.upstream ? {
                id: `refs/remotes/${this.repository.HEAD.upstream.remote}/${this.repository.HEAD.upstream.name}`,
                name: `${this.repository.HEAD.upstream.remote}/${this.repository.HEAD.upstream.name}`,
                revision: this.repository.HEAD.upstream.commit
            } : undefined,
            base: mergeBase &&
                (mergeBase.remote !== this.repository.HEAD.upstream?.remote ||
                    mergeBase.name !== this.repository.HEAD.upstream?.name) ? {
                id: `refs/remotes/${mergeBase.remote}/${mergeBase.name}`,
                name: `${mergeBase.remote}/${mergeBase.name}`,
                revision: mergeBase.commit
            } : undefined
        };
        this.logger.trace(`[GitHistoryProvider][onDidRunGitStatus] currentHistoryItemGroup(${force}): ${JSON.stringify(this.currentHistoryItemGroup)}`);
    }
    async provideHistoryItems(historyItemGroupId, options) {
        //TODO@lszomoru - support limit and cursor
        if (typeof options.limit === 'number') {
            throw new Error('Unsupported options.');
        }
        if (typeof options.limit?.id !== 'string') {
            throw new Error('Unsupported options.');
        }
        const refParentId = options.limit.id;
        const refId = await this.repository.revParse(historyItemGroupId) ?? '';
        const historyItems = [];
        const commits = await this.repository.log({ range: `${refParentId}..${refId}`, shortStats: true, sortByAuthorDate: true });
        await (0, emoji_1.ensureEmojis)();
        historyItems.push(...commits.map(commit => {
            const newLineIndex = commit.message.indexOf('\n');
            const subject = newLineIndex !== -1 ? commit.message.substring(0, newLineIndex) : commit.message;
            return {
                id: commit.hash,
                parentIds: commit.parents,
                message: (0, emoji_1.emojify)(subject),
                author: commit.authorName,
                icon: new vscode_1.ThemeIcon('git-commit'),
                timestamp: commit.authorDate?.getTime(),
                statistics: commit.shortStat ?? { files: 0, insertions: 0, deletions: 0 },
            };
        }));
        return historyItems;
    }
    async provideHistoryItems2(options) {
        if (!this.currentHistoryItemGroup || !options.historyItemGroupIds || typeof options.limit === 'number' || !options.limit?.id) {
            return [];
        }
        // Deduplicate refNames
        const refNames = Array.from(new Set(options.historyItemGroupIds));
        try {
            // Get the common ancestor commit, and commits
            const [mergeBaseCommit, commits] = await Promise.all([
                this.repository.getCommit(options.limit.id),
                this.repository.log({ range: `${options.limit.id}..`, refNames, shortStats: true })
            ]);
            // Add common ancestor commit
            commits.push(mergeBaseCommit);
            await (0, emoji_1.ensureEmojis)();
            return commits.map(commit => {
                const newLineIndex = commit.message.indexOf('\n');
                const subject = newLineIndex !== -1 ? commit.message.substring(0, newLineIndex) : commit.message;
                const labels = this.resolveHistoryItemLabels(commit, refNames);
                return {
                    id: commit.hash,
                    parentIds: commit.parents,
                    message: (0, emoji_1.emojify)(subject),
                    author: commit.authorName,
                    icon: new vscode_1.ThemeIcon('git-commit'),
                    timestamp: commit.authorDate?.getTime(),
                    statistics: commit.shortStat ?? { files: 0, insertions: 0, deletions: 0 },
                    labels: labels.length !== 0 ? labels : undefined
                };
            });
        }
        catch (err) {
            this.logger.error(`[GitHistoryProvider][provideHistoryItems2] Failed to get history items '${options.limit.id}..': ${err}`);
            return [];
        }
    }
    async provideHistoryItemSummary(historyItemId, historyItemParentId) {
        if (!historyItemParentId) {
            const commit = await this.repository.getCommit(historyItemId);
            historyItemParentId = commit.parents.length > 0 ? commit.parents[0] : `${historyItemId}^`;
        }
        const allChanges = await this.repository.diffBetweenShortStat(historyItemParentId, historyItemId);
        return { id: historyItemId, parentIds: [historyItemParentId], message: '', statistics: allChanges };
    }
    async provideHistoryItemChanges(historyItemId, historyItemParentId) {
        if (!historyItemParentId) {
            const commit = await this.repository.getCommit(historyItemId);
            historyItemParentId = commit.parents.length > 0 ? commit.parents[0] : `${historyItemId}^`;
        }
        const historyItemChangesUri = [];
        const historyItemChanges = [];
        const changes = await this.repository.diffBetween(historyItemParentId, historyItemId);
        for (const change of changes) {
            const historyItemUri = change.uri.with({
                query: `ref=${historyItemId}`
            });
            // History item change
            historyItemChanges.push({
                uri: historyItemUri,
                originalUri: (0, uri_1.toGitUri)(change.originalUri, historyItemParentId),
                modifiedUri: (0, uri_1.toGitUri)(change.uri, historyItemId),
                renameUri: change.renameUri,
            });
            // History item change decoration
            const letter = repository_1.Resource.getStatusLetter(change.status);
            const tooltip = repository_1.Resource.getStatusText(change.status);
            const color = repository_1.Resource.getStatusColor(change.status);
            const fileDecoration = new vscode_1.FileDecoration(letter, tooltip, color);
            this.historyItemDecorations.set(historyItemUri.toString(), fileDecoration);
            historyItemChangesUri.push(historyItemUri);
        }
        this._onDidChangeDecorations.fire(historyItemChangesUri);
        return historyItemChanges;
    }
    async resolveHistoryItemGroupCommonAncestor(historyItemId1, historyItemId2) {
        if (!historyItemId2) {
            const upstreamRef = await this.resolveHistoryItemGroupMergeBase(historyItemId1);
            if (!upstreamRef) {
                this.logger.info(`[GitHistoryProvider][resolveHistoryItemGroupCommonAncestor] Failed to resolve history item group base for '${historyItemId1}'`);
                return undefined;
            }
            historyItemId2 = `refs/remotes/${upstreamRef.remote}/${upstreamRef.name}`;
        }
        const ancestor = await this.repository.getMergeBase(historyItemId1, historyItemId2);
        if (!ancestor) {
            this.logger.info(`[GitHistoryProvider][resolveHistoryItemGroupCommonAncestor] Failed to resolve common ancestor for '${historyItemId1}' and '${historyItemId2}'`);
            return undefined;
        }
        try {
            const commitCount = await this.repository.getCommitCount(`${historyItemId1}...${historyItemId2}`);
            this.logger.trace(`[GitHistoryProvider][resolveHistoryItemGroupCommonAncestor] Resolved common ancestor for '${historyItemId1}' and '${historyItemId2}': ${JSON.stringify({ id: ancestor, ahead: commitCount.ahead, behind: commitCount.behind })}`);
            return { id: ancestor, ahead: commitCount.ahead, behind: commitCount.behind };
        }
        catch (err) {
            this.logger.error(`[GitHistoryProvider][resolveHistoryItemGroupCommonAncestor] Failed to get ahead/behind for '${historyItemId1}...${historyItemId2}': ${err.message}`);
        }
        return undefined;
    }
    async resolveHistoryItemGroupCommonAncestor2(historyItemGroupIds) {
        try {
            if (historyItemGroupIds.length === 0) {
                // TODO@lszomoru - log
                return undefined;
            }
            else if (historyItemGroupIds.length === 1 && historyItemGroupIds[0] === this.currentHistoryItemGroup?.id) {
                // Remote
                if (this.currentHistoryItemGroup.remote) {
                    const ancestor = await this.repository.getMergeBase(historyItemGroupIds[0], this.currentHistoryItemGroup.remote.id);
                    return ancestor;
                }
                // Base
                if (this.currentHistoryItemGroup.base) {
                    const ancestor = await this.repository.getMergeBase(historyItemGroupIds[0], this.currentHistoryItemGroup.base.id);
                    return ancestor;
                }
                // First commit
                const commits = await this.repository.log({ maxParents: 0, refNames: ['HEAD'] });
                if (commits.length > 0) {
                    return commits[0].hash;
                }
            }
            else if (historyItemGroupIds.length > 1) {
                const ancestor = await this.repository.getMergeBase(historyItemGroupIds[0], historyItemGroupIds[1], ...historyItemGroupIds.slice(2));
                return ancestor;
            }
        }
        catch (err) {
            this.logger.error(`[GitHistoryProvider][resolveHistoryItemGroupCommonAncestor2] Failed to resolve common ancestor for ${historyItemGroupIds.join(',')}: ${err}`);
        }
        return undefined;
    }
    provideFileDecoration(uri) {
        return this.historyItemDecorations.get(uri.toString());
    }
    resolveHistoryItemLabels(commit, refNames) {
        const labels = [];
        for (const label of commit.refNames) {
            if (!label.startsWith('HEAD -> ') && !refNames.includes(label)) {
                continue;
            }
            for (const [key, value] of this.historyItemLabels) {
                if (label.startsWith(key)) {
                    labels.push({
                        title: label.substring(key.length),
                        icon: new vscode_1.ThemeIcon(value)
                    });
                    break;
                }
            }
        }
        return labels;
    }
    async resolveHistoryItemGroupMergeBase(historyItemId) {
        try {
            // Upstream
            const branch = await this.repository.getBranch(historyItemId);
            if (branch.upstream) {
                return branch.upstream;
            }
            // Base (config -> reflog -> default)
            const remoteBranch = await this.repository.getBranchBase(historyItemId);
            if (!remoteBranch?.remote || !remoteBranch?.name || !remoteBranch?.commit || remoteBranch?.type !== 1 /* RefType.RemoteHead */) {
                this.logger.info(`[GitHistoryProvider][resolveHistoryItemGroupUpstreamOrBase] Failed to resolve history item group base for '${historyItemId}'`);
                return undefined;
            }
            return {
                name: remoteBranch.name,
                remote: remoteBranch.remote,
                commit: remoteBranch.commit
            };
        }
        catch (err) {
            this.logger.error(`[GitHistoryProvider][resolveHistoryItemGroupUpstreamOrBase] Failed to get branch base for '${historyItemId}': ${err.message}`);
        }
        return undefined;
    }
    async resolveHEADMergeBase() {
        if (this.repository.HEAD?.type !== 0 /* RefType.Head */ || !this.repository.HEAD?.name) {
            return undefined;
        }
        const mergeBase = await this.repository.getBranchBase(this.repository.HEAD.name);
        return mergeBase;
    }
    dispose() {
        (0, util_1.dispose)(this.disposables);
    }
}
exports.GitHistoryProvider = GitHistoryProvider;
//# sourceMappingURL=historyProvider.js.map