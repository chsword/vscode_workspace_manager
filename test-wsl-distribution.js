const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function testWSLDistributionValidation() {
    console.log('[WSL Distribution Test] Starting validation test...\n');

    try {
        // Test 1: Get available WSL distributions with UTF-16 handling
        console.log('=== Test 1: Available WSL Distributions ===');
        const { stdout } = await execAsync('wsl -l -q', { encoding: 'buffer' });

        // Convert UTF-16 buffer to string
        const utf16String = stdout.toString('utf16le');
        const availableDistros = utf16String.trim().split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        console.log('Available distributions:', availableDistros);
        console.log('UTF-16 decoded:', JSON.stringify(utf16String));

        // Test 2: Test case sensitivity
        console.log('\n=== Test 2: Case Sensitivity Test ===');
        const testCases = [
            'Ubuntu',      // Exact match
            'ubuntu',      // Lowercase
            'UBUNTU',      // Uppercase
            'NonExistent'  // Non-existent
        ];

        for (const testCase of testCases) {
            console.log(`\nTesting: "${testCase}"`);

            // Find exact match first
            const exactMatch = availableDistros.find(distro => distro === testCase);
            if (exactMatch) {
                console.log(`  ✓ Exact match found: "${exactMatch}"`);
                continue;
            }

            // Try case-insensitive match
            const caseInsensitiveMatch = availableDistros.find(distro =>
                distro.toLowerCase() === testCase.toLowerCase()
            );
            if (caseInsensitiveMatch) {
                console.log(`  ✓ Case-insensitive match found: "${caseInsensitiveMatch}" (original: "${testCase}")`);
                continue;
            }

            console.log(`  ✗ No match found for: "${testCase}"`);
        }

        // Test 3: Test the getCorrectWSLDistribution function logic
        console.log('\n=== Test 3: Function Logic Simulation ===');

        async function getCorrectWSLDistribution(detectedDistro) {
            console.log(`\nValidating distribution: "${detectedDistro}"`);

            try {
                const { stdout } = await execAsync('wsl -l -q', { encoding: 'buffer' });

                // Convert UTF-16 buffer to string
                const utf16String = stdout.toString('utf16le');
                const availableDistros = utf16String.trim().split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);

                console.log(`Available distributions: [${availableDistros.join(', ')}]`);

                // Find exact match first
                const exactMatch = availableDistros.find(distro => distro === detectedDistro);
                if (exactMatch) {
                    console.log(`✓ Exact match: "${exactMatch}"`);
                    return exactMatch;
                }

                // Try case-insensitive match
                const caseInsensitiveMatch = availableDistros.find(distro =>
                    distro.toLowerCase() === detectedDistro.toLowerCase()
                );
                if (caseInsensitiveMatch) {
                    console.log(`✓ Case-insensitive match: "${caseInsensitiveMatch}" (for "${detectedDistro}")`);
                    return caseInsensitiveMatch;
                }

                // If no match found, return the first available distribution
                if (availableDistros.length > 0) {
                    const fallbackDistro = availableDistros[0];
                    console.log(`⚠ No match found, using fallback: "${fallbackDistro}" (for "${detectedDistro}")`);
                    return fallbackDistro;
                }

            } catch (execError) {
                console.error('Error executing wsl command:', execError.message);
            }

            // If all else fails, return the detected distribution as-is
            console.log(`⚠ Returning as-is: "${detectedDistro}"`);
            return detectedDistro;
        }

        // Test the function with different inputs
        const testDistros = ['Ubuntu', 'ubuntu', 'UBUNTU', 'NonExistent'];
        for (const distro of testDistros) {
            const result = await getCorrectWSLDistribution(distro);
            console.log(`Result for "${distro}": "${result}"`);
        }

    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// Run the test
testWSLDistributionValidation().catch(console.error);
