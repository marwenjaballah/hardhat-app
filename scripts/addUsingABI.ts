/**
 * Imports an externally deployed contract using its address and ABI file.
 * This script creates a local artifact for the external contract and records it
 * in deployments.json, allowing interaction via scripts like interact.ts.
 *
 * Usage:
 * npx hardhat run scripts/addUsingABI.ts \
 * --address <contract_address> \
 * --name <contract_name_for_local_reference> \
 * --abi-file <path_to_abi_json_file> \
 * --network-deployed <network_name_where_contract_is_deployed>
 *
 * Example:
 * npx hardhat run scripts/addUsingABI.ts \
 * --address 0xExternalContractAddress... \
 * --name ExternalDAIToken \
 * --abi-file ./abis/ExternalDAIToken.json \
 * --network-deployed mainnet
 */
import { ethers, hardhatArguments } from "hardhat";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from 'uuid';

// Define the structure for entries in deployments.json (consistent with deploy.ts)
interface DeploymentInfo {
  network: string; // Network where the contract is ACTUALLY deployed
  contractName: string;
  contractAddress: string;
  timestamp: string;
  deploymentType: "local" | "external_abi" | "external_code";
  artifactPath: string | null; // Relative to project root, points to the locally generated artifact
  sourcePath?: string;
  uid?: string | null;
  abi?: any[]; // Storing ABI directly in deployments.json
}

interface DeploymentsFile {
  [address: string]: DeploymentInfo;
}

const DEPLOYMENTS_FILE_PATH = path.join(process.cwd(), "deployments.json");
//const EXTERNAL_ARTIFACTS_BASE_DIR = path.join(process.cwd(), "artifacts", "external_contracts");

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
  console.log(`📝 Imported contract info saved to ${DEPLOYMENTS_FILE_PATH}`);
}

function validateAddress(address: string): boolean {
  return ethers.isAddress(address);
}

function validateABI(abiArray: any[]): boolean {
  if (!Array.isArray(abiArray)) return false;
  // Basic check: see if it has common ABI properties like 'name', 'type', 'inputs'
  return abiArray.every(item => typeof item.type === 'string');
}

async function verifyContractAccessibility(address: string, abi: any[]): Promise<boolean> {
  try {
    console.log("🔍 Verifying contract accessibility by calling a view function (if available)...");
    const contract = await ethers.getContractAt(abi, address);
    
    const viewFunction = abi.find(
      (f: any) => f.type === "function" && 
                   (f.stateMutability === "view" || f.stateMutability === "pure") &&
                   (!f.inputs || f.inputs.length === 0) // Prefer parameterless
    );

    if (viewFunction) {
      console.log(`🧪 Attempting to call view function: ${viewFunction.name}()`);
      await contract[viewFunction.name](); // Call the function
      console.log(`✅ Successfully called '${viewFunction.name}()'. Contract seems accessible.`);
      return true;
    } else {
      console.log("ℹ️ No suitable parameterless view function found to test accessibility. Assuming ABI is correct.");
      return true; // Cannot actively verify, but proceed
    }
  } catch (error: any) {
    console.warn(`⚠️ Warning: Could not verify contract accessibility by calling a view function: ${error.message}`);
    console.warn("   This might be due to network issues, incorrect ABI, or the contract not being deployed at the address.");
    return false; // Indicate verification issue
  }
}

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const contractName = process.env.CONTRACT_NAME;
  const abiFilePath = process.env.ABI_FILE;
  const networkDeployedOn = process.env.NETWORK_DEPLOYED;

  if (!contractAddress || !contractName || !abiFilePath || !networkDeployedOn) {
    throw new Error("❌ CONTRACT_ADDRESS, CONTRACT_NAME, ABI_FILE, and NETWORK_DEPLOYED environment variables are required");
  }

  console.log(`🔗 Importing external contract '${contractName}' at address '${contractAddress}' from network '${networkDeployedOn}' using ABI from '${abiFilePath}'`);

  // 1. Validate inputs
  if (!validateAddress(contractAddress)) {
    throw new Error(`❌ Invalid contract address: ${contractAddress}`);
  }
  if (!fs.existsSync(abiFilePath)) {
    throw new Error(`❌ ABI file not found at: ${abiFilePath}`);
  }

  let abi: any[];
  try {
    const abiContent = fs.readFileSync(abiFilePath, "utf8");
    abi = JSON.parse(abiContent);
    if (!validateABI(abi)) {
      throw new Error("❌ ABI file content is not a valid ABI array.");
    }
  } catch (e: any) {
    throw new Error(`❌ Error parsing ABI file: ${e.message}`);
  }
  console.log(`✅ ABI loaded successfully with ${abi.filter(f=>f.type === 'function').length} functions.`);

  // 2. Verify contract accessibility (optional but recommended)
  // Note: This requires the script to be run with a provider connected to `networkDeployedOn`
  // If hardhatArguments.network is different, this might fail or give misleading results.
  // For true verification, ensure --network matches networkDeployedOn or use a generic provider.
  if (hardhatArguments.network && hardhatArguments.network !== networkDeployedOn) {
      console.warn(`⚠️ Verification check will use Hardhat network '${hardhatArguments.network}', but contract is on '${networkDeployedOn}'. Results may be inaccurate if networks differ.`);
  }
  await verifyContractAccessibility(contractAddress, abi);


/*  // 3. Prepare and save local artifact (flat file, not a directory)
const contractUid = uuidv4();
const localArtifactPath = path.join(EXTERNAL_ARTIFACTS_BASE_DIR, `${contractUid}.json`);

// Ensure base directory exists
if (!fs.existsSync(EXTERNAL_ARTIFACTS_BASE_DIR)) {
  fs.mkdirSync(EXTERNAL_ARTIFACTS_BASE_DIR, { recursive: true });
}

const artifactData = {
  _format: "hh-sol-artifact-1",
  contractName: contractName,
  sourceName: `external/${contractUid}/${contractName}.sol`, // Still a placeholder
  abi: abi,
  bytecode: "0x",
  deployedBytecode: "0x",
  linkReferences: {},
  deployedLinkReferences: {},
  importedFromAddress: contractAddress,
  importedAt: new Date().toISOString(),
  importUid: contractUid,
};

fs.writeFileSync(localArtifactPath, JSON.stringify(artifactData, null, 2));
console.log(`✅ Local artifact for '${contractName}' saved to: ${path.relative(process.cwd(), localArtifactPath)}`); */

  // 4. Save to deployments.json
  //const relativeArtifactPath = path.relative(process.cwd(), localArtifactPath).replace(/\\/g, "/");
  const deploymentEntry: DeploymentInfo = {
    network: networkDeployedOn, // Network where it's actually deployed
    contractName: contractName,
    contractAddress: contractAddress.toLowerCase(),
    timestamp: new Date().toISOString(),
    deploymentType: "external_abi",
    artifactPath: null, // Path to the locally created artifact
    uid: null,
    abi: abi, // Store ABI for convenience
  };
  saveDeployment(contractAddress, deploymentEntry);

  
  console.log("\n📋 Import Summary:");
  console.log(`  Contract Name: ${contractName}`);
  console.log(`  Address: ${contractAddress}`);
  console.log(`  Network Deployed: ${networkDeployedOn}`);
  //console.log(`  Local Artifact: ${relativeArtifactPath}`);
  //console.log(`  UID: ${contractUid}`);
  console.log(`\n💡 You can now interact with this contract using its address and the Hardhat network configured to connect to '${networkDeployedOn}'.`);
  console.log(`   Example: npx hardhat run scripts/interact.ts --network <your_network_for_${networkDeployedOn}> --address ${contractAddress} --function <name>`);

  const backendOutput = {
    contractAddress: deploymentEntry.contractAddress,
    transactionHash: null, // Not available since we didn't deploy
    contractName: deploymentEntry.contractName,
    artifactPath: deploymentEntry.artifactPath,
    abi: deploymentEntry.abi,
  };

  console.log("\n📦 Deployment result (JSON):");
  console.log(JSON.stringify(backendOutput, null, 2));


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed to import contract using ABI:");
    console.error(error);
    process.exit(1);
  });
