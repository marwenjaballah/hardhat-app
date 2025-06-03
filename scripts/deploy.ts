/**
 * Deploys a contract from a local Solidity file.
 *
 * Usage:
 * npx hardhat run scripts/deploy.ts --network <networkName> \
 * --contract-path <path_to_sol_file_relative_to_project_root> \
 * --contract-name <NameOfContractToDeploy> \
 * [--constructor-args <json_string_array_of_args>]
 *
 * Example:
 * npx hardhat run scripts/deploy.ts --network localhost \
 * --contract-path contracts/MyToken.sol \
 * --contract-name MyToken \
 * --constructor-args '["My Token", "MTK", 1000000]'
 *
 * Outputs a JSON string with deployment details:
 * {
 * "contractAddress": "0x...",
 * "transactionHash": "0x...",
 * "contractName": "MyToken",
 * "network": "localhost",
 * "timestamp": "ISO_DATE_STRING",
 * "deploymentType": "local",
 * "artifactPath": "artifacts/contracts/MyToken.sol/MyToken.json",
 * "sourcePath": "contracts/MyToken.sol",
 * "abi": [...]
 * }
 */
import { ethers, run, hardhatArguments } from "hardhat";
import fs from "fs";
import path from "path";
import { ParamType } from "ethers";

// Define the structure for entries in deployments.json
interface DeploymentInfo {
  network: string;
  contractName: string;
  contractAddress: string;
  timestamp: string;
  deploymentType: "local" | "external_abi" | "external_code";
  artifactPath: string; // Relative to project root
  sourcePath?: string; // Relative to project root, for local deployments
  uid?: string | null;
  abi?: any[]; // Storing ABI directly in deployments.json can be useful
  transactionHash?: string;
}

interface DeploymentsFile {
  [address: string]: DeploymentInfo;
}

const DEPLOYMENTS_FILE_PATH = path.join(process.cwd(), "deployments.json");

// Helper function to read/write deployments.json
function readDeployments(): DeploymentsFile {
  if (!fs.existsSync(DEPLOYMENTS_FILE_PATH)) {
    return {};
  }
  const raw = fs.readFileSync(DEPLOYMENTS_FILE_PATH, "utf8");
  return JSON.parse(raw) as DeploymentsFile;
}

function saveDeployment(address: string, info: DeploymentInfo): void {
  const deployments = readDeployments();
  deployments[address.toLowerCase()] = info;
  fs.writeFileSync(
    DEPLOYMENTS_FILE_PATH,
    JSON.stringify(deployments, null, 2)
  );
  console.log(`📝 Deployment info saved to ${DEPLOYMENTS_FILE_PATH}`);
}

// Helper function to parse constructor arguments
function parseConstructorArgs(argsString: string | undefined, types: readonly ParamType[]): any[] {
    if (!argsString) {
        if (types.length > 0) {
            throw new Error("Constructor arguments required but not provided.");
        }
        return [];
    }
    try {
        const parsedArgs = JSON.parse(argsString);
        if (!Array.isArray(parsedArgs)) {
            throw new Error("Constructor arguments must be a JSON array.");
        }
        if (parsedArgs.length !== types.length) {
            throw new Error(
                `Incorrect number of constructor arguments. Expected ${types.length}, got ${parsedArgs.length}.`
            );
        }
        return parsedArgs;
    } catch (e: any) {
        throw new Error(`Invalid JSON format for constructor arguments: ${e.message}`);
    }
}

async function main() {
  const contractPath = process.env.CONTRACT_PATH;
  const contractName = process.env.CONTRACT_NAME;
  const constructorArgs = process.env.CONSTRUCTOR_ARGS;

  if (!contractPath || !contractName) {
    throw new Error("❌ CONTRACT_PATH and CONTRACT_NAME environment variables are required");
  }

  if (!hardhatArguments.network) {
    throw new Error("❌ Hardhat network not specified. Use --network <networkName>");
  }
  const networkName = hardhatArguments.network;

  console.log(`🚀 Deploying '${contractName}' from '${contractPath}' on network '${networkName}'...`);

  // 1. Compile contracts
  console.log("🔨 Compiling contracts...");
  await run("compile");
  console.log("✅ Contracts compiled successfully.");

  // 2. Get deployer and contract factory
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer address: ${deployer.address}`);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`💰 Deployer balance: ${ethers.formatEther(balance)} ETH`);

  const fullyQualifiedName = `${contractPath}:${contractName}`;
  const artifact = await ethers.getContractFactory(fullyQualifiedName);

  // 3. Prepare constructor arguments
  const constructorAbiInputs = artifact.interface.deploy?.inputs || [];
  let parsedConstructorArgs: any[] = [];
  if (constructorAbiInputs.length > 0) {
    if (!constructorArgs) {
        throw new Error(`❌ Contract '${contractName}' requires constructor arguments, but none were provided via CONSTRUCTOR_ARGS.`);
    }
    console.log("🔧 Parsing constructor arguments...");
    parsedConstructorArgs = parseConstructorArgs(constructorArgs, constructorAbiInputs);
    console.log(`🔩 Constructor arguments: ${JSON.stringify(parsedConstructorArgs)}`);
  } else if (constructorArgs) {
    console.warn("⚠️ Constructor arguments provided, but contract constructor is empty. Arguments will be ignored.");
  }

  // 4. Deploy contract
  console.log("⏳ Deploying contract...");
  const contractInstance = await artifact.connect(deployer).deploy(...parsedConstructorArgs);
  await contractInstance.waitForDeployment();
  const contractAddress = await contractInstance.getAddress();
  const deploymentTransaction = contractInstance.deploymentTransaction();

  if (!deploymentTransaction) {
    throw new Error("❌ Deployment transaction not found.");
  }
  
  console.log(`✅ Contract '${contractName}' deployed to address: ${contractAddress}`);
  console.log(`🧾 Transaction hash: ${deploymentTransaction.hash}`);

  // 5. Prepare deployment information
  const timestamp = new Date().toISOString();
  const artifactJsonPath = path.join(
    "artifacts", // Hardhat's default artifacts directory
    contractPath,
    `${contractName}.json`
  ).replace(/\\/g, "/"); // Normalize path for consistency

  const deploymentOutput: DeploymentInfo & { abi: any[], transactionHash: string } = {
    network: networkName,
    contractName: contractName,
    contractAddress: contractAddress,
    timestamp: timestamp,
    deploymentType: "local",
    artifactPath: artifactJsonPath,
    sourcePath: contractPath.replace(/\\/g, "/"),
    uid: null,
    abi: [...artifact.interface.fragments], // Convert readonly array to mutable array
    transactionHash: deploymentTransaction.hash,
  };

  // 6. Save to deployments.json
  // Create a slimmed-down version for deployments.json, ABI can be large
  const deploymentEntry: DeploymentInfo = {
    ...deploymentOutput
  };
  // delete deploymentEntry.abi; // Optionally remove ABI from deployments.json if it's too large
                               // and always read from artifactPath. For now, keeping it.
  // delete deploymentEntry.transactionHash; // transactionHash is also part of the output, not typically stored in deployments.json this way

  saveDeployment(contractAddress, deploymentEntry);

  // 7. Output JSON result for backend consumption
  // The backend expects: contractAddress, transactionHash, abi
  const backendOutput = {
    contractAddress: deploymentOutput.contractAddress,
    transactionHash: deploymentOutput.transactionHash,
    contractName: deploymentOutput.contractName,
    artifactPath: deploymentOutput.artifactPath, // Useful for backend to know where artifact is
    abi: deploymentOutput.abi
  };
  console.log("📦 Deployment result (JSON):");
  console.log(JSON.stringify(backendOutput, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment script failed:");
    console.error(error);
    process.exit(1);
  });
