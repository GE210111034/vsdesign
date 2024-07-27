"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisposableStore = exports.Disposable = void 0;
exports.disposeAll = disposeAll;
function disposeAll(disposables) {
    for (const disposable of disposables) {
        disposable.dispose();
    }
    disposables.length = 0;
}
class Disposable {
    constructor() {
        this._isDisposed = false;
        this._disposables = [];
    }
    dispose() {
        if (this._isDisposed) {
            return;
        }
        this._isDisposed = true;
        disposeAll(this._disposables);
    }
    _register(value) {
        if (this._isDisposed) {
            value.dispose();
        }
        else {
            this._disposables.push(value);
        }
        return value;
    }
    get isDisposed() {
        return this._isDisposed;
    }
}
exports.Disposable = Disposable;
class DisposableStore extends Disposable {
    add(disposable) {
        this._register(disposable);
        return disposable;
    }
}
exports.DisposableStore = DisposableStore;
//# sourceMappingURL=dispose.js.map