const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Fixed extractWSLDistribution function
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

// Fixed getCorrectWSLDistribution function
async function getCorrectWSLDistribution(detectedDistro) {
    try {
        // If it's already 'default', try to detect the actual distribution
        if (detectedDistro === 'default' || detectedDistro === 'Unknown') {
            // Try to get the default WSL distribution
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            try {
                const { stdout } = await execAsync('wsl -l -q', { encoding: 'buffer' });
                // Convert UTF-16 buffer to string (WSL outputs UTF-16)
                const utf16String = stdout.toString('utf16le');
                const lines = utf16String.trim().split('\n').filter(line => line.trim());
                if (lines.length > 0) {
                    // Get the first (default) distribution
                    const defaultDistro = lines[0].trim();
                    return defaultDistro;
                }
            } catch (execError) {
                console.error('Error getting WSL distributions:', execError.message);
            }
        }

        // Validate the detected distribution against available ones
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        try {
            const { stdout } = await execAsync('wsl -l -q', { encoding: 'buffer' });
            // Convert UTF-16 buffer to string (WSL outputs UTF-16)
            const utf16String = stdout.toString('utf16le');
            const availableDistros = utf16String.trim().split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            // Find exact match first
            const exactMatch = availableDistros.find(distro => distro === detectedDistro);
            if (exactMatch) {
                return exactMatch;
            }

            // Try case-insensitive match
            const caseInsensitiveMatch = availableDistros.find(distro =>
                distro.toLowerCase() === detectedDistro.toLowerCase()
            );
            if (caseInsensitiveMatch) {
                return caseInsensitiveMatch;
            }

            // If no match found, return the first available distribution
            if (availableDistros.length > 0) {
                const fallbackDistro = availableDistros[0];
                return fallbackDistro;
            }

        } catch (execError) {
            console.error('Error validating WSL distribution:', execError.message);
        }

        // If all else fails, return the detected distribution as-is
        return detectedDistro;

    } catch (error) {
        console.error('Error in getCorrectWSLDistribution:', error.message);
        return detectedDistro; // Return original if error occurs
    }
}

// Complete test for user's WSL path
async function testCompleteUserWSLPath() {
    console.log('=== Complete User WSL Path Test ===\n');

    const userPath = '\\\\wsl$\\wsl%2Bubuntu\\root\\next-chat\\workspace.code-workspace';
    console.log('User path:', userPath);

    // Step 1: Extract distribution
    const extractedDistro = extractWSLDistribution(userPath);
    console.log('1. Extracted distribution:', extractedDistro);

    // Step 2: Validate/correct distribution
    const correctedDistro = await getCorrectWSLDistribution(extractedDistro);
    console.log('2. Corrected distribution:', correctedDistro);

    // Step 3: Decode and convert path
    let wslPath = userPath;
    try {
        wslPath = decodeURIComponent(wslPath);
        console.log('3. Decoded path:', wslPath);
    } catch (decodeError) {
        console.error('Decode error:', decodeError.message);
    }

    // Step 4: Convert Windows path to Unix path
    if (wslPath.startsWith('\\\\wsl$\\')) {
        const parts = wslPath.split('\\');
        if (parts.length >= 4) {
            wslPath = '/' + parts.slice(4).join('/');
        }
        console.log('4. Converted Unix path:', wslPath);
    }

    // Step 5: Generate final VS Code command
    const expectedCommand = `code -n --remote wsl+${correctedDistro} ${wslPath}`;
    const expectedUri = `vscode-remote://wsl+${correctedDistro}${wslPath}`;

    console.log('\n=== Final Results ===');
    console.log('Expected VS Code command:', expectedCommand);
    console.log('Expected VS Code URI:', expectedUri);

    // Verify the results match user expectations
    const userExpectedCommand = 'code -n --remote wsl+ubuntu /root/next-chat/workspace.code-workspace';
    const userExpectedUri = 'vscode-remote://wsl+ubuntu/root/next-chat/workspace.code-workspace';

    console.log('\n=== Verification ===');
    console.log('Command matches user expectation:', expectedCommand === userExpectedCommand);
    console.log('URI matches user expectation:', expectedUri === userExpectedUri);

    if (expectedCommand !== userExpectedCommand || expectedUri !== userExpectedUri) {
        console.log('\nDifferences:');
        if (expectedCommand !== userExpectedCommand) {
            console.log('Command - Expected:', userExpectedCommand);
            console.log('Command - Got:', expectedCommand);
        }
        if (expectedUri !== userExpectedUri) {
            console.log('URI - Expected:', userExpectedUri);
            console.log('URI - Got:', expectedUri);
        }
    } else {
        console.log('✅ All results match user expectations!');
    }
}

testCompleteUserWSLPath().catch(console.error);
