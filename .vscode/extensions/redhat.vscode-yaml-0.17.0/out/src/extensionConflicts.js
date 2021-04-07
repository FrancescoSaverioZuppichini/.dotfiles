"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showUninstallConflictsNotification = exports.getConflictingExtensions = void 0;
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved..
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const vscode_1 = require("vscode");
// A set of VSCode extension ID's that conflict with VSCode-YAML
const azureDeploy = 'ms-vscode-deploy-azure.azure-deploy';
const conflictingIDs = new Set(['vscoss.vscode-ansible', azureDeploy, 'sysninja.vscode-ansible-mod', 'haaaad.ansible']);
// A set of VSCode extension ID's that are currently uninstalling
const uninstallingIDs = new Set();
/**
 * Get all of the installed extensions that currently conflict with VSCode-YAML
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getConflictingExtensions() {
    const conflictingExtensions = [];
    conflictingIDs.forEach((extension) => {
        const ext = vscode_1.extensions.getExtension(extension);
        if (ext && !uninstallingIDs.has(ext.id)) {
            conflictingExtensions.push(ext);
        }
    });
    return conflictingExtensions;
}
exports.getConflictingExtensions = getConflictingExtensions;
/**
 * Display the uninstall conflicting extension notification if there are any conflicting extensions currently installed
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function showUninstallConflictsNotification(conflictingExts) {
    // Add all available conflicting extensions to the uninstalling IDs map
    for (const extIndex in conflictingExts) {
        const ext = conflictingExts[extIndex];
        uninstallingIDs.add(ext.id);
    }
    const uninstallMsg = 'Uninstall';
    // Gather all the conflicting display names
    let conflictMsg = '';
    if (conflictingExts.length === 1) {
        conflictMsg = `${conflictingExts[0].packageJSON.displayName} extension is incompatible with VSCode-YAML. Please uninstall it.`;
    }
    else {
        const extNames = [];
        conflictingExts.forEach((ext) => {
            extNames.push(ext.packageJSON.displayName);
        });
        conflictMsg = `The ${extNames.join(', ')} extensions are incompatible with VSCode-YAML. Please uninstall them.`;
    }
    if (conflictingExts.length > 0) {
        vscode_1.window.showInformationMessage(conflictMsg, uninstallMsg).then((clickedMsg) => {
            if (clickedMsg === uninstallMsg) {
                conflictingExts.forEach((ext) => {
                    vscode_1.commands.executeCommand('workbench.extensions.uninstallExtension', ext.id);
                    uninstallingIDs.delete(ext.id);
                });
                // The azure deploy extension must be reloaded in order to be completely uninstalled
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (conflictingExts.findIndex((ext) => ext.id === azureDeploy) !== -1) {
                    vscode_1.commands.executeCommand('workbench.action.reloadWindow');
                }
            }
        });
    }
}
exports.showUninstallConflictsNotification = showUninstallConflictsNotification;
//# sourceMappingURL=extensionConflicts.js.map