/**
 * Interacts with a deployed smart contract.
 *
 * Usage:
 * npx hardhat run scripts/interact.ts --network <networkName> \
 * --address <contract_address> \
 * --function <function_name> \
 * [--args <json_string_array_of_args>]
 *
 * Example (View/Pure function):
 * npx hardhat run scripts/interact.ts --network localhost \
 * --address 0xContractAddress... \
 * --function getBalance \
 * --args '["0xAccountAddress..."]'
 *
 * Example (State-changing function):
 * npx hardhat run scripts/interact.ts --network localhost \
 * --address 0xContractAddress... \
 * --function transfer \
 * --args '["0xRecipientAddress...", 100]'
 *
 * Outputs structured JSON result:
 * {
 * "success": true,
 * "contractAddress": "0x...",
 * "functionName": "transfer",
 * "network": "localhost",
 * "timestamp": "ISO_DATE_STRING",
 * "functionType": "view|transaction",
 * "result": {...},
 * "transactionHash": "0x...", // Only for transactions
 * "gasUsed": "123456", // Only for transactions
 * "blockNumber": 12345 // Only for transactions
 * }
 */
import { ethers, hardhatArguments } from "hardhat";
import fs from "fs";
import path from "path";
import { ParamType} from "ethers";

// Define the structure for entries in deployments.json (consistent with deploy.ts)
interface DeploymentInfo {
  network: string;
  contractName: string;
  contractAddress: string;
  timestamp: string;
  deploymentType: "local" | "external_abi" | "external_code";
  artifactPath: string; // Relative to project root
  sourcePath?: string;
  uid?: string | null;
  abi: any[]; // ABI might be stored here or loaded from artifactPath
}

interface DeploymentsFile {
  [address: string]: DeploymentInfo;
}

// Enhanced backend response structure
interface BackendInteractionResult {
  success: boolean;
  contractAddress: string;
  functionName: string;
  network: string;
  timestamp: string;
  functionType: "view" | "transaction";
  result?: any;
  transactionHash?: string;
  gasUsed?: string;
  blockNumber?: number;
  logs?: any[];
  signerAddress?: string;
  error?: string;
}

const DEPLOYMENTS_FILE_PATH = path.join(process.cwd(), "deployments.json");

function readDeployments(): DeploymentsFile {
  if (!fs.existsSync(DEPLOYMENTS_FILE_PATH)) {
    console.warn(`⚠️ Deployments file not found at ${DEPLOYMENTS_FILE_PATH}. No contracts to interact with.`);
    return {};
  }
  const raw = fs.readFileSync(DEPLOYMENTS_FILE_PATH, "utf8");
  return JSON.parse(raw) as DeploymentsFile;
}

// Helper function to parse function arguments
function parseFunctionArgs(argsString: string | undefined, expectedTypes: readonly ParamType[]): any[] {
    if (!argsString) {
        if (expectedTypes.length > 0) {
            throw new Error("Function arguments required but not provided.");
        }
        return [];
    }
    try {
        const parsedArgs = JSON.parse(argsString);
        if (!Array.isArray(parsedArgs)) {
            throw new Error("Function arguments must be a JSON array.");
        }
        if (parsedArgs.length !== expectedTypes.length) {
            throw new Error(
                `Incorrect number of function arguments. Expected ${expectedTypes.length}, got ${parsedArgs.length}.`
            );
        }
        return parsedArgs;
    } catch (e: any) {
        throw new Error(`Invalid JSON format for function arguments: ${e.message}`);
    }
}

// Helper function to format complex return values for JSON serialization
function formatReturnValue(value: any): any {
  if (typeof value === 'bigint') {
    return value.toString();
  } else if (Array.isArray(value)) {
    return value.map(item => formatReturnValue(item));
  } else if (typeof value === 'object' && value !== null) {
    const formatted: any = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key) && isNaN(Number(key))) {
        formatted[key] = formatReturnValue(value[key]);
      }
    }
    return formatted;
  }
  return value;
}

// Helper function to output result for backend
function outputBackendResult(result: BackendInteractionResult): void {
  console.log("📦 Interaction result (JSON):");
  console.log(JSON.stringify(result, null, 0)); // Compact JSON for easier parsing
}

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const functionName = process.env.CONTRACT_FUNCTION;
  const functionArgs = process.env.CONTRACT_ARGS;

  if (!contractAddress || !functionName) {
    const errorResult: BackendInteractionResult = {
      success: false,
      error: "CONTRACT_ADDRESS and CONTRACT_FUNCTION environment variables are required",
      contractAddress: contractAddress || "",
      functionName: functionName || "",
      network: hardhatArguments.network || "",
      timestamp: new Date().toISOString(),
      functionType: "view"
    };
    outputBackendResult(errorResult);
    throw new Error("❌ CONTRACT_ADDRESS and CONTRACT_FUNCTION environment variables are required");
  }

  if (!hardhatArguments.network) {
    const errorResult: BackendInteractionResult = {
      success: false,
      error: "Hardhat network not specified. Use --network <networkName>",
      contractAddress: contractAddress,
      functionName: functionName,
      network: "",
      timestamp: new Date().toISOString(),
      functionType: "view"
    };
    outputBackendResult(errorResult);
    throw new Error("❌ Hardhat network not specified. Use --network <networkName>");
  }

  const networkName = hardhatArguments.network;
  const targetAddress = contractAddress.toLowerCase();

  try {
    console.log(`📡 Attempting to call function '${functionName}' on contract '${targetAddress}' on network '${networkName}'...`);

    // 1. Load deployments
    const deployments = readDeployments();
    const deploymentInfo = deployments[targetAddress];

    if (!deploymentInfo) {
      throw new Error(`❌ Contract with address ${targetAddress} not found in ${DEPLOYMENTS_FILE_PATH}.`);
    }

    if (deploymentInfo.network !== networkName) {
      console.warn(`⚠️ Warning: Interacting with contract on network '${networkName}', but it was recorded as deployed/imported on '${deploymentInfo.network}'.`);
    }

    // 2. Get ABI
    let abi: any[];
    //if (deploymentInfo.abi && deploymentInfo.abi.length > 0) {
      console.log("📘 Using ABI from deployments.json entry.");
      abi = deploymentInfo.abi;
    /*}  else {
      console.log(`📘 Loading ABI from artifact: ${deploymentInfo.artifactPath}`);
      const artifactFullPath = path.join(process.cwd(), deploymentInfo.artifactPath);
      if (!fs.existsSync(artifactFullPath)) {
        throw new Error(`❌ Artifact file not found at ${artifactFullPath}. Check 'artifactPath' in deployments.json.`);
      }
      const artifactContent = JSON.parse(fs.readFileSync(artifactFullPath, "utf8"));
      if (!artifactContent.abi) {
          throw new Error(`❌ ABI not found in artifact file: ${artifactFullPath}`);
      }
      abi = artifactContent.abi;
    } */

    // 3. Get contract instance
    const contract = await ethers.getContractAt(abi, targetAddress);

    // 4. Find function definition and parse arguments
    const functionFragment = contract.interface.getFunction(functionName);
    if (!functionFragment) {
      const formatOutput = contract.interface.format() as string[];
      const availableFunctions = formatOutput
        .filter((line: string) => line.includes('function'))
        .map((line: string) => line.split('(')[0].trim().replace('function ', ''))
        .join(', ');
      throw new Error(`❌ Function '${functionName}' not found in contract ABI. Available functions: ${availableFunctions}`);
    }

    const parsedArgs = parseFunctionArgs(functionArgs, functionFragment.inputs);
    console.log(`🔧 Parsed arguments for '${functionName}': ${JSON.stringify(parsedArgs)}`);

    const timestamp = new Date().toISOString();

    // 5. Call function
    if (functionFragment.stateMutability === "view" || functionFragment.stateMutability === "pure") {
      console.log("🔍 Calling view/pure function...");
      const result = await (contract as any)[functionName](...parsedArgs);
      console.log("✅ Result:");
      
      const formattedResult = formatReturnValue(result);
      
      // Display result in console
      if (typeof result === 'bigint') {
          console.log(result.toString());
      } else if (Array.isArray(result)) {
          console.log(result.map(item => typeof item === 'bigint' ? item.toString() : item));
      } else if (typeof result === 'object' && result !== null) {
          console.log(formattedResult);
      } else {
          console.log(result);
      }

      // Enhanced backend result for view functions
      const backendResult: BackendInteractionResult = {
        success: true,
        contractAddress: targetAddress,
        functionName: functionName,
        network: networkName,
        timestamp: timestamp,
        functionType: "view",
        result: formattedResult
      };

      outputBackendResult(backendResult);

    } else {
      console.log("💸 Sending transaction...");
      const [signer] = await ethers.getSigners();
      console.log(`👤 Using signer: ${signer.address}`);
      const tx = await (contract as any).connect(signer)[functionName](...parsedArgs);
      console.log(`⏳ Transaction sent. Hash: ${tx.hash}`);
      console.log("⏱️ Waiting for transaction confirmation...");
      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed! Block number: ${receipt?.blockNumber}, Gas used: ${receipt?.gasUsed.toString()}`);
      
      let parsedLogs: any[] = [];
      if (receipt?.logs && receipt.logs.length > 0) {
          console.log("📋 Logs:");
          receipt.logs.forEach((log: any, index: number) => {
              try {
                  const parsedLog = contract.interface.parseLog(log);
                  const formattedArgs = parsedLog?.args.map(arg => formatReturnValue(arg));
                  console.log(`  [${index}] ${parsedLog?.name}: ${JSON.stringify(formattedArgs)}`);
                  parsedLogs.push({
                    name: parsedLog?.name,
                    args: formattedArgs,
                    index: index
                  });
              } catch (e) {
                   console.log(`  [${index}] Unparsed log (topic0: ${log.topics[0]})`);
                   parsedLogs.push({
                     unparsed: true,
                     topic0: log.topics[0],
                     index: index
                   });
              }
          });
      }

      // Enhanced backend result for transactions
      const backendResult: BackendInteractionResult = {
        success: true,
        contractAddress: targetAddress,
        functionName: functionName,
        network: networkName,
        timestamp: timestamp,
        functionType: "transaction",
        transactionHash: tx.hash,
        gasUsed: receipt?.gasUsed?.toString(),
        blockNumber: receipt?.blockNumber,
        logs: parsedLogs.length > 0 ? parsedLogs : undefined,
        signerAddress: signer.address
      };

      outputBackendResult(backendResult);
    }

  } catch (error: any) {
    // Enhanced error handling with structured output
    const errorResult: BackendInteractionResult = {
      success: false,
      error: error.message || "Unknown interaction error",
      contractAddress: contractAddress,
      functionName: functionName,
      network: networkName,
      timestamp: new Date().toISOString(),
      functionType: "view" // Default, as we can't determine at this point
    };
    
    outputBackendResult(errorResult);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Interaction script failed:");
    console.error(error);
    process.exit(1);
  });