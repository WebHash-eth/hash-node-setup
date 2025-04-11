import { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import { NodeRegistryContract } from "../src/contracts/nodeRegistry.js";

function shouldExist(key: string) {
  const env = process.env;
  if (!env[key]) {
    throw new Error(`Missing ${key} environment variable`);
  }
  return env[key];
}

const config = {
  NODE_REGISTRY_CONTRACT_ADDRESS: "0xA8841266B81b1ae704D3C3e569266fA71a2db491",
  NETWORK: process.env.CHAIN_ID === "8453" ? "base" : "baseSepolia",
  PRIVATE_KEY: shouldExist("PRIVATE_KEY"),
  PEER_ID: shouldExist("PEER_ID"),
  STORAGE: (() => {
    const s = shouldExist("STORAGE");
    const storage = BigInt(s);
    if (storage <= 0n) {
      throw new Error(`Invalid STORAGE value: ${storage}`);
    }
    return storage;
  })(),
};

function addHexPrefix(hex: string): Hex {
  return hex.startsWith("0x") ? (hex as Hex) : `0x${hex}`;
}

const account = privateKeyToAccount(addHexPrefix(config.PRIVATE_KEY));
const contract = new NodeRegistryContract({
  account,
  chain: chains[config.NETWORK] as chains.Chain,
  contractAddress: config.NODE_REGISTRY_CONTRACT_ADDRESS as Address,
});

try {
  const tx = await contract.registerNode(config.PEER_ID, config.STORAGE);
  console.log(`Node registered with transaction hash: ${tx.transactionHash}`);
} catch (err) {
  if (err.message?.includes("Node already registered")) {
    console.log("Node already registered");
  } else {
    console.error(err);
  }
}
