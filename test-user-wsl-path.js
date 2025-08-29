const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Test the specific WSL path from user
async function testUserWSLPath() {
    console.log('=== Testing User WSL Path ===\n');

    const testPath = '\\\\wsl$\\wsl%2Bubuntu\\root\\next-chat\\workspace.code-workspace';
    console.log('Original path:', testPath);

    // Test decodeURIComponent
    try {
        const decodedPath = decodeURIComponent(testPath);
        console.log('Decoded path:', decodedPath);

        // Test path splitting
        const parts = decodedPath.split('\\');
        console.log('Path parts:', parts);

        // Test our current logic
        if (parts.length >= 4) {
            const convertedPath = '/' + parts.slice(4).join('/');
            console.log('Converted path:', convertedPath);
        }

        // Test distribution extraction
        const distroMatch = decodedPath.match(/\\\\wsl\$\\([^\\]+)/);
        if (distroMatch) {
            console.log('Extracted distribution (raw):', distroMatch[1]);

            // Check if it's URL encoded
            if (distroMatch[1].includes('%')) {
                const decodedDistro = decodeURIComponent(distroMatch[1]);
                console.log('Decoded distribution:', decodedDistro);
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    }

    // Test the expected final result
    console.log('\n=== Expected Result ===');
    console.log('Expected VS Code command: code -n --remote wsl+ubuntu /root/next-chat/workspace.code-workspace');
    console.log('Expected URI: vscode-remote://wsl+ubuntu/root/next-chat/workspace.code-workspace');

    // Test with actual WSL distributions
    try {
        const { stdout } = await execAsync('wsl -l -q', { encoding: 'buffer' });
        const utf16String = stdout.toString('utf16le');
        const availableDistros = utf16String.trim().split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        console.log('\nAvailable WSL distributions:', availableDistros);

        // Test distribution name matching
        const extractedDistro = 'wsl%2Bubuntu';
        console.log('\nTesting distribution matching:');
        console.log('Extracted (URL encoded):', extractedDistro);

        if (extractedDistro.includes('%')) {
            const decodedDistro = decodeURIComponent(extractedDistro);
            console.log('Decoded distribution:', decodedDistro);

            // Try to find exact match
            const exactMatch = availableDistros.find(distro => distro === decodedDistro);
            if (exactMatch) {
                console.log('✓ Exact match found:', exactMatch);
            } else {
                // Try case-insensitive match
                const caseInsensitiveMatch = availableDistros.find(distro =>
                    distro.toLowerCase() === decodedDistro.toLowerCase()
                );
                if (caseInsensitiveMatch) {
                    console.log('✓ Case-insensitive match found:', caseInsensitiveMatch);
                } else {
                    console.log('✗ No match found for:', decodedDistro);
                    console.log('Available options:', availableDistros);
                }
            }
        }

    } catch (error) {
        console.error('WSL command error:', error.message);
    }
}

testUserWSLPath().catch(console.error);
