// Test the fixed WSL distribution extraction
function extractWSLDistribution(workspacePath) {
    // \\wsl$\Ubuntu-20.04\home\user\project
    let match = workspacePath.match(/\\\\wsl\$\\([^\\]+)/);
    if (match) {
        let distro = match[1];
        // Handle URL-encoded distribution names (e.g., wsl%2Bubuntu -> wsl+ubuntu)
        try {
            distro = decodeURIComponent(distro);
        } catch (decodeError) {
            // If decode fails, use original
        }
        // If the distribution name starts with 'wsl+', extract the actual name
        if (distro.startsWith('wsl+')) {
            distro = distro.substring(4); // Remove 'wsl+' prefix
        }
        return distro;
    }

    // wsl+Ubuntu-20.04
    match = workspacePath.match(/wsl\+([^:/]+)/);
    if (match) {
        return match[1];
    }

    // /mnt/c/ or /mnt/d/ paths
    if (workspacePath.includes('/mnt/')) {
        return 'WSL';
    }

    return 'Unknown';
}

// Test cases
const testCases = [
    '\\\\wsl$\\wsl%2Bubuntu\\root\\next-chat\\workspace.code-workspace',
    '\\\\wsl$\\Ubuntu\\home\\user\\project',
    '\\\\wsl$\\ubuntu\\home\\user\\project',
    'vscode-remote://wsl+Ubuntu/home/user/project',
    '/mnt/c/Users/user/project'
];

console.log('=== Testing Fixed WSL Distribution Extraction ===\n');

testCases.forEach((testPath, index) => {
    console.log(`Test ${index + 1}: ${testPath}`);
    const extracted = extractWSLDistribution(testPath);
    console.log(`Extracted: ${extracted}\n`);
});

console.log('=== Expected Results ===');
console.log('Test 1 (user path): ubuntu');
console.log('Test 2 (normal Ubuntu): Ubuntu');
console.log('Test 3 (lowercase ubuntu): ubuntu');
console.log('Test 4 (vscode-remote): Ubuntu');
console.log('Test 5 (/mnt/ path): WSL');
