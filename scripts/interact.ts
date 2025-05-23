import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import deploymentsJson from "../contracts/deployments.json";
// Parse CLI args

type DeploymentRecord = {
    [address: string]: {
      contract: string;
      artifact: string; // e.g., "contracts/Adder.sol:Adder"
    };
  };
const deployments = deploymentsJson as DeploymentRecord;
const [address, fnName, ...fnArgsRaw] = process.argv.slice(2);
if (!address || !fnName) {
  console.error("❌ Usage: <Address> <FunctionName> [args...]");
  process.exit(1);
}

const fnArgs = fnArgsRaw.map(arg => {
  if (arg === "true" || arg === "false") return arg === "true";
  if (/^0x[a-fA-F0-9]{40}$/.test(arg)) return arg;
  try {
    const parsed = JSON.parse(arg);
    return parsed;
  } catch {}
  if (!isNaN(Number(arg))) return Number(arg);
  return arg;
});



function getABIForAddress(address: string): any {
  const entry = deployments[address.toLowerCase()];
  if (!entry) {
    throw new Error(`❌ No deployment entry found for address ${address}`);
  }

  const [filePath, contractName] = entry.artifact.split(":");
  const artifactPath = path.join(__dirname, "..", "artifacts", filePath, `${contractName}.json`);

  if (!fs.existsSync(artifactPath)) {
    throw new Error(`❌ ABI artifact not found: ${artifactPath}`);
  }

  const content = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return content.abi;
}
  

async function main() {
    const abi = getABIForAddress(address);
  if (!abi) {
    console.error(`❌ Could not find ABI for function "${fnName}"`);
    process.exit(1);
  }

  const contract = await ethers.getContractAt(abi, address);

  const fnDef = abi.find((f: any) => f.name === fnName && f.type === "function");
  if (!fnDef) {
    console.error(`❌ Function "${fnName}" not found in ABI`);
    process.exit(1);
  }

  console.log(`📡 Calling ${fnName}(${fnArgs.join(", ")}) on ${address}`);

  if (fnDef.stateMutability === "view" || fnDef.stateMutability === "pure") {
    const result = await (contract as any)[fnName](...fnArgs);
    console.log("✅ Result:", result);
  } else {
    const [signer] = await ethers.getSigners();
    const tx = await (contract.connect(signer) as any)[fnName](...fnArgs);
    console.log("⏳ Tx sent:", tx.hash);
    await tx.wait();
    console.log("✅ Transaction confirmed!");
  }
}

main().catch((err) => {
  console.error("❌ Interaction failed:", err);
  process.exit(1);
});
