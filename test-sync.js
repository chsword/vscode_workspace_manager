const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Test SQLite reading function
async function testSQLiteReading() {
    try {
        const platform = os.platform();
        const homeDir = os.homedir();
        
        let dbPath;
        
        switch (platform) {
            case 'win32':
                dbPath = path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'state.vscdb');
                break;
            case 'darwin':
                dbPath = path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'state.vscdb');
                break;
            case 'linux':
                dbPath = path.join(homeDir, '.config', 'Code', 'User', 'globalStorage', 'state.vscdb');
                break;
            default:
                console.log('Unsupported platform');
                return;
        }

        console.log('Checking database path:', dbPath);
        
        if (!fs.existsSync(dbPath)) {
            console.log('VS Code SQLite database not found');
            return;
        }

        // Execute SQLite query
        const query = `SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'`;
        const command = `sqlite3 "${dbPath}" "${query}" -csv`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Error executing SQLite query:', error);
                return;
            }
            
            if (stderr) {
                console.error('SQLite stderr:', stderr);
                return;
            }
            
            if (stdout.trim()) {
                try {
                    // Fix escaped double quotes in CSV output
                    let jsonString = stdout.trim();
                    if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
                        jsonString = jsonString.slice(1, -1);
                    }
                    jsonString = jsonString.replace(/""/g, '"');
                    
                    const historyData = JSON.parse(jsonString);
                    console.log(`Found ${historyData.entries.length} history entries`);
                    
                    const workspaces = [];
                    
                    for (const entry of historyData.entries) {
                        if (entry.workspace?.configPath) {
                            const uri = decodeVSCodeUri(entry.workspace.configPath);
                            if (uri) {
                                workspaces.push({ type: 'workspace', path: uri, label: entry.label });
                            }
                        } else if (entry.folderUri && !entry.folderUri.includes('/.vscode/')) {
                            const uri = decodeVSCodeUri(entry.folderUri);
                            if (uri) {
                                workspaces.push({ type: 'folder', path: uri, label: entry.label });
                            }
                        }
                    }
                    
                    console.log(`\nExtracted ${workspaces.length} workspaces:`);
                    workspaces.slice(0, 10).forEach((ws, i) => {
                        console.log(`${i + 1}. [${ws.type}] ${ws.path}`);
                        if (ws.label) console.log(`   Label: ${ws.label}`);
                    });
                    
                    if (workspaces.length > 10) {
                        console.log(`   ... and ${workspaces.length - 10} more`);
                    }
                    
                } catch (parseError) {
                    console.error('Error parsing JSON:', parseError);
                    console.log('Raw output:', stdout);
                }
            } else {
                console.log('No history data found');
            }
        });
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

function decodeVSCodeUri(uri) {
    try {
        if (uri.startsWith('file:///')) {
            const path = decodeURIComponent(uri.substring(8));
            if (path.match(/^\/[a-zA-Z]:/)) {
                return path.substring(1);
            }
            return path;
        } else if (uri.startsWith('vscode-remote://')) {
            const match = uri.match(/vscode-remote:\/\/([^/]+)(.+)/);
            if (match) {
                const [, authority, remotePath] = match;
                return `${authority}:${remotePath}`;
            }
        }
        return null;
    } catch (error) {
        console.warn('Failed to decode VS Code URI:', uri, error);
        return null;
    }
}

console.log('Testing VS Code SQLite history reading...');
testSQLiteReading();
