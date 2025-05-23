import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";


type Deployments = {
    [address: string]: {
        contract: string;
        artifact: string;
    };
};

async function main() {
    // Get address and ABI from command line arguments
    const [address, abiPath] = process.argv.slice(2);
    
    if (!address || !abiPath) {
        console.error("❌ Usage: npx hardhat run scripts/addExternalContract.ts <address> <abi-file-path>");
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

    // Check if contract exists at the address
    try {
        console.log(`🔍 Checking if contract exists at ${address}...`);
        const provider = ethers.provider;
        const code = await provider.getCode(address);
        
        if (code === "0x") {
            console.error("❌ No contract found at the specified address");
            process.exit(1);
        }

        // Try to create a contract instance to verify ABI
        const contract = new ethers.Contract(address, contractABI, provider);
        
        // Try to call a view function if available to verify ABI
        const viewFunctions = contractABI.filter(
            (fn: any) => fn.type === "function" && 
            (fn.stateMutability === "view" || fn.stateMutability === "pure")
        );

        if (viewFunctions.length > 0) {
            try {
                // Try to call the first view function
                await contract[viewFunctions[0].name]();
                console.log("✅ Contract verified successfully");
            } catch (error) {
                console.warn("⚠️ Warning: Could not verify contract ABI - some functions might not match");
            }
        }

    } catch (error) {
        console.error("❌ Error verifying contract:", error);
        process.exit(1);
    }

    // 1. Add to deployments.json
    const deploymentsPath = path.join("contracts", "deployments.json");
    let deployments: Deployments = {};
    
    if (fs.existsSync(deploymentsPath)) {
        deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
    }

    // Check if contract is already in deployments.json
    if (deployments[address]) {
        console.log("⚠️ Contract already exists in deployments.json, updating...");
    }

    deployments[address] = {
        contract: "ExternalContract",
        artifact: "contracts/ExternalContract.sol:ExternalContract"
    };

    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));

    // 2. Create artifact
    const artifactDir = path.join("artifacts", "contracts", "ExternalContract.sol");
    if (!fs.existsSync(artifactDir)) {
        fs.mkdirSync(artifactDir, { recursive: true });
    }

    const artifact = {
        contractName: "ExternalContract",
        abi: contractABI,
        bytecode: "0x",
        deployedBytecode: "0x"
    };

    fs.writeFileSync(
        path.join(artifactDir, "ExternalContract.json"),
        JSON.stringify(artifact, null, 2)
    );

    console.log(`✅ Successfully added external contract at ${address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });