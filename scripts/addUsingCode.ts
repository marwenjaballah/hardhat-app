/**
 * Imports an externally deployed contract using its address and Solidity source code.
 * This script compiles the source code to generate an artifact, stores it locally,
 * and records the contract in deployments.json.
 *
 * Usage:
 * npx hardhat run scripts/addUsingCode.ts \
 * --address <contract_address> \
 * --name <contract_name_for_local_reference> \
 * --source-file <path_to_solidity_file.sol> \
 * --network-deployed <network_name_where_contract_is_deployed> \
 * [--cleanup-temp-source <true|false>]
 *
 * Example:
 * npx hardhat run scripts/addUsingCode.ts \
 * --address 0xAnotherExternalContract... \
 * --name ExternalGovToken \
 * --source-file ./external_sources/GovToken.sol \
 * --network-deployed mainnet \
 * --cleanup-temp-source true
 */
import { ethers, run, hardhatArguments } from "hardhat";
import fs from "fs-extra"; // Using fs-extra for easier directory operations
import path from "path";

// Define the structure for entries in deployments.json
interface DeploymentInfo {
  network: string;
  contractName: string;
  contractAddress: string;
  timestamp: string;
  deploymentType: "local" | "external_abi" | "external_code";
  artifactPath: string | null;
  sourcePath?: string; // Path to the temporary source used for compilation
  uid?: string | null;
  abi?: any[];
}

interface DeploymentsFile {
  [address: string]: DeploymentInfo;
}

const DEPLOYMENTS_FILE_PATH = path.join(process.cwd(), "deployments.json");

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

async function verifyContractAccessibility(address: string, abi: any[]): Promise<boolean> {
  try {
    console.log("🔍 Verifying contract accessibility by calling a view function (if available)...");
    const contract = await ethers.getContractAt(abi, address);
    
    const viewFunction = abi.find(
      (f: any) => f.type === "function" && 
                   (f.stateMutability === "view" || f.stateMutability === "pure") &&
                   (!f.inputs || f.inputs.length === 0)
    );

    if (viewFunction) {
      console.log(`🧪 Attempting to call view function: ${viewFunction.name}()`);
      await contract[viewFunction.name]();
      console.log(`✅ Successfully called '${viewFunction.name}()'. Contract seems accessible.`);
      return true;
    } else {
      console.log("ℹ️ No suitable parameterless view function found to test accessibility. Assuming compiled ABI is correct.");
      return true;
    }
  } catch (error: any) {
    console.warn(`⚠️ Warning: Could not verify contract accessibility: ${error.message}`);
    return false;
  }
}

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const contractName = process.env.CONTRACT_NAME;
  const sourceFilePath = process.env.SOURCE_FILE;
  const networkDeployedOn = process.env.NETWORK_DEPLOYED;

  if (!contractAddress || !contractName || !sourceFilePath || !networkDeployedOn) {
    throw new Error("❌ CONTRACT_ADDRESS, CONTRACT_NAME, SOURCE_FILE, and NETWORK_DEPLOYED environment variables are required");
  }

  console.log(`🔗 Importing external contract '${contractName}' at address '${contractAddress}' from network '${networkDeployedOn}' using source code from '${sourceFilePath}'`);

  // 1. Validate inputs
  if (!validateAddress(contractAddress)) {
    throw new Error(`❌ Invalid contract address: ${contractAddress}`);
  }
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error(`❌ Source code file not found at: ${sourceFilePath}`);
  }
  if (!sourceFilePath.endsWith(".sol")) {
      throw new Error(`❌ Source file must be a .sol file: ${sourceFilePath}`);
  }
  // 2. Compile the specific temporary contract
  console.log("🔨 Compiling temporary source code via Hardhat...");
  await run("compile"); // This compiles the whole project, including the new temp file
  console.log("✅ Compilation successful.");

  const hardhatArtifactPath = path.join(process.cwd(), "artifacts", "contracts", `${contractName}.sol`, `${contractName}.json`);
    
  try {
    // 2. Verify the compiled artifact exists
    if (!fs.existsSync(hardhatArtifactPath)) {
      throw new Error(`❌ Compiled artifact not found at expected location: ${hardhatArtifactPath}. Please compile the contract first.`);
    }

    const artifactContent = JSON.parse(fs.readFileSync(hardhatArtifactPath, "utf8"));
    const abi = artifactContent.abi;
    if (!abi) {
        throw new Error("❌ ABI not found in compiled artifact.");
    }

    // 3. Verify contract accessibility (optional)
    if (hardhatArguments.network && hardhatArguments.network !== networkDeployedOn) {
      console.warn(`⚠️ Verification check will use Hardhat network '${hardhatArguments.network}', but contract is on '${networkDeployedOn}'. Results may be inaccurate if networks differ.`);
    }
    await verifyContractAccessibility(contractAddress, abi);

    // 4. Save to deployments.json
    //const relativeHardhatArtifactPath = path.relative(process.cwd(), hardhatArtifactPath).replace(/\\/g, "/");
    //const relativeSourcePath = path.relative(process.cwd(), sourceFilePath).replace(/\\/g, "/");

    const deploymentEntry: DeploymentInfo = {
      network: networkDeployedOn,
      contractName: contractName,
      contractAddress: contractAddress.toLowerCase(),
      timestamp: new Date().toISOString(),
      deploymentType: "external_code",
      artifactPath: null,
      //sourcePath: relativeSourcePath,
      uid: null,
      abi: abi,
    };
    saveDeployment(contractAddress, deploymentEntry);

    console.log("\n📋 Import Summary:");
    console.log(`  Contract Name: ${contractName}`);
    console.log(`  Address: ${contractAddress}`);
    console.log(`  Network Deployed: ${networkDeployedOn}`);
    //console.log(`  Local Artifact: ${relativeHardhatArtifactPath}`);
    //console.log(`\n💡 You can now interact with this contract using its address and the Hardhat network configured to connect to '${networkDeployedOn}'.`);
    
    const backendOutput = {
      contractAddress: deploymentEntry.contractAddress,
      transactionHash: null, // Not available since we didn't deploy
      contractName: deploymentEntry.contractName,
      artifactPath: deploymentEntry.artifactPath,
      abi: deploymentEntry.abi,
    };

    console.log("\n📦 Deployment result (JSON):");
    console.log(JSON.stringify(backendOutput, null, 2));



  } catch (error) {
    console.error("❌ Failed to import contract:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed to import contract using source code:");
    console.error(error);
    process.exit(1);
  });
