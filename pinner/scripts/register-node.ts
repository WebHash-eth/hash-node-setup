import { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import { NodeRegistryContract } from "../src/contracts/nodeRegistry.js";
import config from "../src/config.js";

const { PEER_ID, STORAGE: STORAGE_STRING } = process.env;

if (!PEER_ID || !STORAGE_STRING) {
  throw new Error("Missing PEER_ID or STORAGE environment variables");
}
const STORAGE = BigInt(STORAGE_STRING);

if (!Object.keys(chains).includes(config.NETWORK)) {
  throw new Error("Invalid network");
}

function addHexPrefix(hex: string): Hex {
  return hex.startsWith("0x") ? (hex as Hex) : `0x${hex}`;
}

const account = privateKeyToAccount(addHexPrefix(config.PRIVATE_KEY));
const contract = new NodeRegistryContract({
  account,
  chain: chains[config.NETWORK] as chains.Chain,
  contractAddress: config.NODE_REGISTRY_CONTRACT_ADDRESS as Address,
});

await contract.registerNode(PEER_ID, STORAGE);
