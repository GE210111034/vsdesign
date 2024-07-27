"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutError = exports.IntervalTimer = exports.SequencerByKey = void 0;
exports.raceCancellationError = raceCancellationError;
exports.raceTimeoutError = raceTimeoutError;
exports.raceCancellationAndTimeoutError = raceCancellationAndTimeoutError;
const vscode_1 = require("vscode");
class SequencerByKey {
    constructor() {
        this.promiseMap = new Map();
    }
    queue(key, promiseTask) {
        const runningPromise = this.promiseMap.get(key) ?? Promise.resolve();
        const newPromise = runningPromise
            .catch(() => { })
            .then(promiseTask)
            .finally(() => {
            if (this.promiseMap.get(key) === newPromise) {
                this.promiseMap.delete(key);
            }
        });
        this.promiseMap.set(key, newPromise);
        return newPromise;
    }
}
exports.SequencerByKey = SequencerByKey;
class IntervalTimer extends vscode_1.Disposable {
    constructor() {
        super(() => this.cancel());
        this._token = -1;
    }
    cancel() {
        if (this._token !== -1) {
            clearInterval(this._token);
            this._token = -1;
        }
    }
    cancelAndSet(runner, interval) {
        this.cancel();
        this._token = setInterval(() => {
            runner();
        }, interval);
    }
}
exports.IntervalTimer = IntervalTimer;
/**
 * Returns a promise that rejects with an {@CancellationError} as soon as the passed token is cancelled.
 * @see {@link raceCancellation}
 */
function raceCancellationError(promise, token) {
    return new Promise((resolve, reject) => {
        const ref = token.onCancellationRequested(() => {
            ref.dispose();
            reject(new vscode_1.CancellationError());
        });
        promise.then(resolve, reject).finally(() => ref.dispose());
    });
}
class TimeoutError extends Error {
    constructor() {
        super('Timed out');
    }
}
exports.TimeoutError = TimeoutError;
function raceTimeoutError(promise, timeout) {
    return new Promise((resolve, reject) => {
        const ref = setTimeout(() => {
            reject(new vscode_1.CancellationError());
        }, timeout);
        promise.then(resolve, reject).finally(() => clearTimeout(ref));
    });
}
function raceCancellationAndTimeoutError(promise, token, timeout) {
    return raceCancellationError(raceTimeoutError(promise, timeout), token);
}
//# sourceMappingURL=async.js.map