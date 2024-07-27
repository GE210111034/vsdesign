"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.Versions = exports.PromiseSource = exports.Limiter = exports.EmptyDisposable = exports.isWindows = exports.isMacintosh = void 0;
exports.log = log;
exports.dispose = dispose;
exports.toDisposable = toDisposable;
exports.combinedDisposable = combinedDisposable;
exports.fireEvent = fireEvent;
exports.mapEvent = mapEvent;
exports.filterEvent = filterEvent;
exports.runAndSubscribeEvent = runAndSubscribeEvent;
exports.anyEvent = anyEvent;
exports.done = done;
exports.onceEvent = onceEvent;
exports.debounceEvent = debounceEvent;
exports.eventToPromise = eventToPromise;
exports.once = once;
exports.assign = assign;
exports.uniqBy = uniqBy;
exports.groupBy = groupBy;
exports.mkdirp = mkdirp;
exports.uniqueFilter = uniqueFilter;
exports.find = find;
exports.grep = grep;
exports.readBytes = readBytes;
exports.detectUnicodeEncoding = detectUnicodeEncoding;
exports.isDescendant = isDescendant;
exports.pathEquals = pathEquals;
exports.relativePath = relativePath;
exports.splitInChunks = splitInChunks;
exports.isDefined = isDefined;
exports.isUndefinedOrNull = isUndefinedOrNull;
exports.isUndefined = isUndefined;
const vscode_1 = require("vscode");
const path_1 = require("path");
const fs_1 = require("fs");
const byline = require("byline");
exports.isMacintosh = process.platform === 'darwin';
exports.isWindows = process.platform === 'win32';
function log(...args) {
    console.log.apply(console, ['git:', ...args]);
}
function dispose(disposables) {
    disposables.forEach(d => d.dispose());
    return [];
}
function toDisposable(dispose) {
    return { dispose };
}
function combinedDisposable(disposables) {
    return toDisposable(() => dispose(disposables));
}
exports.EmptyDisposable = toDisposable(() => null);
function fireEvent(event) {
    return (listener, thisArgs, disposables) => event(_ => listener.call(thisArgs), null, disposables);
}
function mapEvent(event, map) {
    return (listener, thisArgs, disposables) => event(i => listener.call(thisArgs, map(i)), null, disposables);
}
function filterEvent(event, filter) {
    return (listener, thisArgs, disposables) => event(e => filter(e) && listener.call(thisArgs, e), null, disposables);
}
function runAndSubscribeEvent(event, handler, initial) {
    handler(initial);
    return event(e => handler(e));
}
function anyEvent(...events) {
    return (listener, thisArgs, disposables) => {
        const result = combinedDisposable(events.map(event => event(i => listener.call(thisArgs, i))));
        disposables?.push(result);
        return result;
    };
}
function done(promise) {
    return promise.then(() => undefined);
}
function onceEvent(event) {
    return (listener, thisArgs, disposables) => {
        const result = event(e => {
            result.dispose();
            return listener.call(thisArgs, e);
        }, null, disposables);
        return result;
    };
}
function debounceEvent(event, delay) {
    return (listener, thisArgs, disposables) => {
        let timer;
        return event(e => {
            clearTimeout(timer);
            timer = setTimeout(() => listener.call(thisArgs, e), delay);
        }, null, disposables);
    };
}
function eventToPromise(event) {
    return new Promise(c => onceEvent(event)(c));
}
function once(fn) {
    const didRun = false;
    return (...args) => {
        if (didRun) {
            return;
        }
        return fn(...args);
    };
}
function assign(destination, ...sources) {
    for (const source of sources) {
        Object.keys(source).forEach(key => destination[key] = source[key]);
    }
    return destination;
}
function uniqBy(arr, fn) {
    const seen = Object.create(null);
    return arr.filter(el => {
        const key = fn(el);
        if (seen[key]) {
            return false;
        }
        seen[key] = true;
        return true;
    });
}
function groupBy(arr, fn) {
    return arr.reduce((result, el) => {
        const key = fn(el);
        result[key] = [...(result[key] || []), el];
        return result;
    }, Object.create(null));
}
async function mkdirp(path, mode) {
    const mkdir = async () => {
        try {
            await fs_1.promises.mkdir(path, mode);
        }
        catch (err) {
            if (err.code === 'EEXIST') {
                const stat = await fs_1.promises.stat(path);
                if (stat.isDirectory()) {
                    return;
                }
                throw new Error(`'${path}' exists and is not a directory.`);
            }
            throw err;
        }
    };
    // is root?
    if (path === (0, path_1.dirname)(path)) {
        return true;
    }
    try {
        await mkdir();
    }
    catch (err) {
        if (err.code !== 'ENOENT') {
            throw err;
        }
        await mkdirp((0, path_1.dirname)(path), mode);
        await mkdir();
    }
    return true;
}
function uniqueFilter(keyFn) {
    const seen = Object.create(null);
    return element => {
        const key = keyFn(element);
        if (seen[key]) {
            return false;
        }
        seen[key] = true;
        return true;
    };
}
function find(array, fn) {
    let result = undefined;
    array.some(e => {
        if (fn(e)) {
            result = e;
            return true;
        }
        return false;
    });
    return result;
}
async function grep(filename, pattern) {
    return new Promise((c, e) => {
        const fileStream = (0, fs_1.createReadStream)(filename, { encoding: 'utf8' });
        const stream = byline(fileStream);
        stream.on('data', (line) => {
            if (pattern.test(line)) {
                fileStream.close();
                c(true);
            }
        });
        stream.on('error', e);
        stream.on('end', () => c(false));
    });
}
function readBytes(stream, bytes) {
    return new Promise((complete, error) => {
        let done = false;
        const buffer = Buffer.allocUnsafe(bytes);
        let bytesRead = 0;
        stream.on('data', (data) => {
            const bytesToRead = Math.min(bytes - bytesRead, data.length);
            data.copy(buffer, bytesRead, 0, bytesToRead);
            bytesRead += bytesToRead;
            if (bytesRead === bytes) {
                stream.destroy(); // Will trigger the close event eventually
            }
        });
        stream.on('error', (e) => {
            if (!done) {
                done = true;
                error(e);
            }
        });
        stream.on('close', () => {
            if (!done) {
                done = true;
                complete(buffer.slice(0, bytesRead));
            }
        });
    });
}
function detectUnicodeEncoding(buffer) {
    if (buffer.length < 2) {
        return null;
    }
    const b0 = buffer.readUInt8(0);
    const b1 = buffer.readUInt8(1);
    if (b0 === 0xFE && b1 === 0xFF) {
        return "utf16be" /* Encoding.UTF16be */;
    }
    if (b0 === 0xFF && b1 === 0xFE) {
        return "utf16le" /* Encoding.UTF16le */;
    }
    if (buffer.length < 3) {
        return null;
    }
    const b2 = buffer.readUInt8(2);
    if (b0 === 0xEF && b1 === 0xBB && b2 === 0xBF) {
        return "utf8" /* Encoding.UTF8 */;
    }
    return null;
}
function normalizePath(path) {
    // Windows & Mac are currently being handled
    // as case insensitive file systems in VS Code.
    if (exports.isWindows || exports.isMacintosh) {
        return path.toLowerCase();
    }
    return path;
}
function isDescendant(parent, descendant) {
    if (parent === descendant) {
        return true;
    }
    if (parent.charAt(parent.length - 1) !== path_1.sep) {
        parent += path_1.sep;
    }
    return normalizePath(descendant).startsWith(normalizePath(parent));
}
function pathEquals(a, b) {
    return normalizePath(a) === normalizePath(b);
}
/**
 * Given the `repository.root` compute the relative path while trying to preserve
 * the casing of the resource URI. The `repository.root` segment of the path can
 * have a casing mismatch if the folder/workspace is being opened with incorrect
 * casing which is why we attempt to use substring() before relative().
 */
function relativePath(from, to) {
    // There are cases in which the `from` path may contain a trailing separator at
    // the end (ex: "C:\", "\\server\folder\" (Windows) or "/" (Linux/macOS)) which
    // is by design as documented in https://github.com/nodejs/node/issues/1765. If
    // the trailing separator is missing, we add it.
    if (from.charAt(from.length - 1) !== path_1.sep) {
        from += path_1.sep;
    }
    if (isDescendant(from, to) && from.length < to.length) {
        return to.substring(from.length);
    }
    // Fallback to `path.relative`
    return (0, path_1.relative)(from, to);
}
function* splitInChunks(array, maxChunkLength) {
    let current = [];
    let length = 0;
    for (const value of array) {
        let newLength = length + value.length;
        if (newLength > maxChunkLength && current.length > 0) {
            yield current;
            current = [];
            newLength = value.length;
        }
        current.push(value);
        length = newLength;
    }
    if (current.length > 0) {
        yield current;
    }
}
/**
 * @returns whether the provided parameter is defined.
 */
function isDefined(arg) {
    return !isUndefinedOrNull(arg);
}
/**
 * @returns whether the provided parameter is undefined or null.
 */
function isUndefinedOrNull(obj) {
    return (isUndefined(obj) || obj === null);
}
/**
 * @returns whether the provided parameter is undefined.
 */
function isUndefined(obj) {
    return (typeof obj === 'undefined');
}
class Limiter {
    constructor(maxDegreeOfParalellism) {
        this.maxDegreeOfParalellism = maxDegreeOfParalellism;
        this.outstandingPromises = [];
        this.runningPromises = 0;
    }
    queue(factory) {
        return new Promise((c, e) => {
            this.outstandingPromises.push({ factory, c, e });
            this.consume();
        });
    }
    consume() {
        while (this.outstandingPromises.length && this.runningPromises < this.maxDegreeOfParalellism) {
            const iLimitedTask = this.outstandingPromises.shift();
            this.runningPromises++;
            const promise = iLimitedTask.factory();
            promise.then(iLimitedTask.c, iLimitedTask.e);
            promise.then(() => this.consumed(), () => this.consumed());
        }
    }
    consumed() {
        this.runningPromises--;
        if (this.outstandingPromises.length > 0) {
            this.consume();
        }
    }
}
exports.Limiter = Limiter;
class PromiseSource {
    constructor() {
        this._onDidComplete = new vscode_1.EventEmitter();
    }
    get promise() {
        if (this._promise) {
            return this._promise;
        }
        return eventToPromise(this._onDidComplete.event).then(completion => {
            if (completion.success) {
                return completion.value;
            }
            else {
                throw completion.err;
            }
        });
    }
    resolve(value) {
        if (!this._promise) {
            this._promise = Promise.resolve(value);
            this._onDidComplete.fire({ success: true, value });
        }
    }
    reject(err) {
        if (!this._promise) {
            this._promise = Promise.reject(err);
            this._onDidComplete.fire({ success: false, err });
        }
    }
}
exports.PromiseSource = PromiseSource;
var Versions;
(function (Versions) {
    function compare(v1, v2) {
        if (typeof v1 === 'string') {
            v1 = fromString(v1);
        }
        if (typeof v2 === 'string') {
            v2 = fromString(v2);
        }
        if (v1.major > v2.major) {
            return 1;
        }
        if (v1.major < v2.major) {
            return -1;
        }
        if (v1.minor > v2.minor) {
            return 1;
        }
        if (v1.minor < v2.minor) {
            return -1;
        }
        if (v1.patch > v2.patch) {
            return 1;
        }
        if (v1.patch < v2.patch) {
            return -1;
        }
        if (v1.pre === undefined && v2.pre !== undefined) {
            return 1;
        }
        if (v1.pre !== undefined && v2.pre === undefined) {
            return -1;
        }
        if (v1.pre !== undefined && v2.pre !== undefined) {
            return v1.pre.localeCompare(v2.pre);
        }
        return 0;
    }
    Versions.compare = compare;
    function from(major, minor, patch, pre) {
        return {
            major: typeof major === 'string' ? parseInt(major, 10) : major,
            minor: typeof minor === 'string' ? parseInt(minor, 10) : minor,
            patch: patch === undefined || patch === null ? 0 : typeof patch === 'string' ? parseInt(patch, 10) : patch,
            pre: pre,
        };
    }
    Versions.from = from;
    function fromString(version) {
        const [ver, pre] = version.split('-');
        const [major, minor, patch] = ver.split('.');
        return from(major, minor, patch, pre);
    }
    Versions.fromString = fromString;
})(Versions || (exports.Versions = Versions = {}));
//# sourceMappingURL=util.js.map