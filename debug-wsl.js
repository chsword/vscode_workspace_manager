#!/usr/bin/env node

/**
 * WSL Workspace Debug Script
 * This script helps debug WSL workspace opening issues by simulating the process
 * and providing detailed logging information.
 */

const path = require('path');

// Mock workspace data for testing
const testWorkspaces = [
    {
        id: 'wsl-folder-test',
        name: 'WSL Folder Test',
        path: '\\\\wsl$\\Ubuntu\\home\\user\\projects\\test-project',
        type: 'folder',
        location: {
            type: 'wsl',
            details: {
                wslDistribution: 'Ubuntu'
            }
        }
    },
    {
        id: 'wsl-workspace-test',
        name: 'WSL Workspace File Test',
        path: '\\\\wsl$\\Ubuntu\\home\\user\\projects\\test.code-workspace',
        type: 'workspace',
        location: {
            type: 'wsl',
            details: {
                wslDistribution: 'Ubuntu'
            }
        }
    },
    {
        id: 'mnt-wsl-test',
        name: 'MNT WSL Test',
        path: '/mnt/wsl/Ubuntu/home/user/projects/test-project',
        type: 'folder',
        location: {
            type: 'wsl',
            details: {
                wslDistribution: 'Ubuntu'
            }
        }
    }
];

/**
 * Log with timestamp
 */
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level}: ${message}`;
    console.log(logMessage);
    if (Object.keys(data).length > 0) {
        console.log(JSON.stringify(data, null, 2));
    }
}

/**
 * Simulate WSL path processing
 */
function processWslPath(workspace) {
    log('INFO', `Processing WSL workspace: ${workspace.name}`, {
        id: workspace.id,
        originalPath: workspace.path,
        type: workspace.type,
        locationType: workspace.location.type
    });

    let wslPath = workspace.path;
    const distro = workspace.location.details?.wslDistribution || 'default';

    log('INFO', `Detected WSL distribution: ${distro}`);

    // Decode URL-encoded characters in the path
    try {
        const originalPath = wslPath;
        wslPath = decodeURIComponent(wslPath);
        if (originalPath !== wslPath) {
            log('INFO', 'URL decoded path', { original: originalPath, decoded: wslPath });
        }
    } catch (decodeError) {
        log('ERROR', 'Failed to decode URL', { error: decodeError.message, originalPath: workspace.path });
    }

    // Convert Windows WSL path to Unix path for vscode-remote
    const originalPath = wslPath;
    if (wslPath.startsWith('\\\\wsl$\\')) {
        // \\wsl$\Ubuntu\home\user\project -> /home/user/project
        const parts = wslPath.split('\\');
        if (parts.length >= 4) {
            wslPath = '/' + parts.slice(4).join('/');
            log('INFO', 'Converted Windows WSL path', {
                original: originalPath,
                converted: wslPath,
                partsSkipped: parts.slice(0, 4),
                partsUsed: parts.slice(4)
            });
        } else {
            log('ERROR', 'Invalid Windows WSL path format', {
                path: wslPath,
                parts: parts,
                expectedFormat: '\\\\wsl$\\Distro\\path\\to\\workspace'
            });
        }
    } else if (wslPath.startsWith('/mnt/wsl/')) {
        // /mnt/wsl/Ubuntu/home/user/project -> /home/user/project
        wslPath = wslPath.replace('/mnt/wsl/' + distro, '');
        log('INFO', 'Converted /mnt/wsl/ path', { original: originalPath, converted: wslPath, distro });
    } else if (wslPath.includes('\\')) {
        // Convert backslashes to forward slashes
        wslPath = wslPath.replace(/\\/g, '/');
        log('INFO', 'Converted backslashes to forward slashes', { original: originalPath, converted: wslPath });
    } else {
        log('INFO', 'Path already in Unix format', { path: wslPath });
    }

    // Ensure path starts with /
    if (!wslPath.startsWith('/')) {
        wslPath = '/' + wslPath;
        log('INFO', 'Added leading slash', { finalPath: wslPath });
    }

    // Generate the appropriate URI
    let finalUri;
    if (workspace.type === 'workspace') {
        // For .code-workspace files, use file URI
        finalUri = `file://${wslPath}`;
        log('INFO', 'Generated file URI for workspace file', { uri: finalUri });
    } else {
        // For folders, use vscode-remote URI
        finalUri = `vscode-remote://wsl+${distro}${wslPath}`;
        log('INFO', 'Generated vscode-remote URI for folder', { uri: finalUri });
    }

    return {
        originalPath: workspace.path,
        processedPath: wslPath,
        finalUri,
        distro,
        workspaceType: workspace.type
    };
}

/**
 * Main debug function
 */
function debugWslWorkspaces() {
    log('INFO', 'Starting WSL Workspace Debug Test');
    log('INFO', '================================');

    console.log('\nTesting WSL workspace path processing...\n');

    for (const workspace of testWorkspaces) {
        console.log(`\n--- Testing: ${workspace.name} ---`);
        try {
            const result = processWslPath(workspace);
            console.log('\nResult:');
            console.log(JSON.stringify(result, null, 2));
        } catch (error) {
            log('ERROR', `Failed to process workspace ${workspace.name}`, {
                error: error.message,
                stack: error.stack
            });
        }
        console.log('--- End Test ---\n');
    }

    log('INFO', 'WSL Workspace Debug Test Completed');
    console.log('\nInstructions:');
    console.log('1. Copy the URIs above and try opening them manually in VS Code');
    console.log('2. Check VS Code Developer Console for any errors');
    console.log('3. Verify WSL extension is installed and WSL distribution is running');
    console.log('4. Compare the generated URIs with what the extension produces');
}

// Run the debug test
if (require.main === module) {
    debugWslWorkspaces();
}

module.exports = { processWslPath, debugWslWorkspaces };
