"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const httpRequest = require("request-light");
const jsonContributions_1 = require("./features/jsonContributions");
async function activate(context) {
    context.subscriptions.push((0, jsonContributions_1.addJSONProviders)(httpRequest.xhr, undefined));
}
function deactivate() {
}
//# sourceMappingURL=npmBrowserMain.js.map