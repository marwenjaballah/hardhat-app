import * as fs from "fs";
import * as path from "path";

async function main() {
    // Get address, contract name and ABI from command line arguments
    const [address, contractName, abiPath] = process.argv.slice(2);
    
    if (!address || !contractName || !abiPath) {
        console.error("❌ Usage: npx hardhat run scripts/addExternalContract.ts <address> <contract-name> <abi-file-path>");
        process.exit(1);
    }

    // Read ABI from file
    let contractABI;
    try {
        const abiContent = fs.readFileSync(abiPath, 'utf8');
        contractABI = JSON.parse(abiContent);
    } catch (error) {
        console.error("❌ Error reading ABI file:", error);
        process.exit(1);
    }

    // 1. Add to deployments.json
    const deploymentsPath = path.join("contracts", "deployments.json");
    let deployments: Record<string, any> = {};
    
    if (fs.existsSync(deploymentsPath)) {
        deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
    }

    deployments[address] = {
        contract: contractName,
        artifact: `contracts/${contractName}.sol:${contractName}`
    };

    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));

    // 2. Create artifact
    const artifactDir = path.join("artifacts", "contracts", `${contractName}.sol`);
    if (!fs.existsSync(artifactDir)) {
        fs.mkdirSync(artifactDir, { recursive: true });
    }

    const artifact = {
        contractName: contractName,
        abi: contractABI,
        bytecode: "0x",
        deployedBytecode: "0x"
    };

    fs.writeFileSync(
        path.join(artifactDir, `${contractName}.json`),
        JSON.stringify(artifact, null, 2)
    );

    console.log(`✅ Successfully added external contract ${contractName} at ${address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });