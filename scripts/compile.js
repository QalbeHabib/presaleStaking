const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getContractSize(contractName) {
  try {
    // Path to the compiled contract artifact
    const artifactPath = path.join(
      __dirname,
      '..',
      'artifacts',
      'contracts',
      `${contractName}.sol`,
      `${contractName}.json`,
    );

    if (!fs.existsSync(artifactPath)) {
      console.error(`Artifact for ${contractName} not found at ${artifactPath}`);
      return null;
    }

    // Read and parse the artifact
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    // Get the bytecode (without the 0x prefix)
    const bytecode = artifact.bytecode.startsWith('0x')
      ? artifact.bytecode.slice(2)
      : artifact.bytecode;

    // Calculate size in bytes
    const sizeInBytes = bytecode.length / 2;

    // Return the size in KB
    return {
      sizeInBytes,
      sizeInKB: sizeInBytes / 1024,
    };
  } catch (error) {
    console.error(`Error getting size for ${contractName}:`, error);
    return null;
  }
}

async function main() {
  try {
    // Compile the contracts
    console.log('Compiling contracts...');
    execSync('npx hardhat compile', { stdio: 'inherit' });

    // Get sizes for our contracts
    const contracts = ['Sale', 'SaleBase', 'StakingManager'];

    console.log('\nContract Sizes:');
    console.log('--------------------------------------------------');
    console.log('Contract               | Size (bytes) | Size (KB)');
    console.log('--------------------------------------------------');

    let anyExceedsLimit = false;
    const sizeLimit = 24 * 1024; // 24KB in bytes

    for (const contract of contracts) {
      const size = getContractSize(contract);

      if (size) {
        const exceedsLimit = size.sizeInBytes > sizeLimit;
        const status = exceedsLimit ? '❌ EXCEEDS LIMIT' : '✅ OK';
        anyExceedsLimit = anyExceedsLimit || exceedsLimit;

        console.log(
          `${contract.padEnd(22)} | ${size.sizeInBytes.toString().padEnd(12)} | ${size.sizeInKB
            .toFixed(2)
            .padEnd(8)} | ${status}`,
        );
      } else {
        console.log(`${contract.padEnd(22)} | Error getting size`);
      }
    }

    console.log('--------------------------------------------------');
    console.log(`Size Limit: ${sizeLimit} bytes (${sizeLimit / 1024} KB)`);
    console.log('--------------------------------------------------');

    if (anyExceedsLimit) {
      console.log('\n⚠️ Some contracts exceed the 24KB size limit.');
    } else {
      console.log('\n✅ All contracts are within the 24KB size limit.');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
