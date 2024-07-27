"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsManager = void 0;
exports.getData = getData;
function getData(key) {
    const element = document.getElementById('vscode-markdown-preview-data');
    if (element) {
        const data = element.getAttribute(key);
        if (data) {
            return JSON.parse(data);
        }
    }
    throw new Error(`Could not load data for ${key}`);
}
class SettingsManager {
    constructor() {
        this._settings = getData('data-settings');
    }
    get settings() {
        return this._settings;
    }
    updateSettings(newSettings) {
        this._settings = newSettings;
    }
}
exports.SettingsManager = SettingsManager;
//# sourceMappingURL=settings.js.map