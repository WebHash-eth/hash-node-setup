import { CID } from "multiformats";
import {
  Address,
  createPublicClient,
  createWalletClient,
  Hex,
  hexToBytes,
  PublicClient,
  webSocket,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import config from "./config.js";
import { ContentRegistryContract } from "./contracts/contentRegistry.js";
import { onEnsContentHashChanged } from "./ens.js";
import { pinContentToIpfs } from "./ipfs.js";
import logger from "./logger.js";

const wsTransport = webSocket(config.CHAIN_WS_URL, {
  reconnect: {
    attempts: Infinity,
  },
});
logger.info(`Connecting to chain: ${config.CHAIN_WS_URL}...`);

const account = privateKeyToAccount(config.PRIVATE_KEY);
const publicClient = createPublicClient({
  chain: chains[config.NETWORK],
  transport: wsTransport,
}) as PublicClient;

const walletClient = createWalletClient({
  chain: chains[config.NETWORK],
  transport: wsTransport,
  account,
});

const contentContract = new ContentRegistryContract({
  contractAddress: config.CONTENT_REGISTRY_CONTRACT_ADDRESS,
  publicClient,
  walletClient,
});

function withErrorLogger<Args extends unknown[], Ret>(
  callback: (...args: Args) => Promise<Ret>,
) {
  return async (...args: Args): Promise<Ret | void> => {
    try {
      return callback(...args);
    } catch (err) {
      logger.error({ err }, `Error executing ${callback.name}`);
    }
  };
}

async function registerContent(uploader: Address, hexCid: Hex) {
  const cid = CID.decode(hexToBytes(hexCid));
  logger.info({ uploader, cid }, "Pinning content");
  const pinResult = await pinContentToIpfs(cid);
  logger.info({ pinResult }, "Pinned content to IPFS");
  // TODO: This may fail if content registry doesn't have this CID registered yet, find a solution
  const tx = await contentContract.confirmPin(hexCid);
  logger.info({ tx: tx.transactionHash }, "Confirmed pin on-chain");
}

async function main() {
  logger.info("Starting pinner service...");
  const callback = withErrorLogger(registerContent);
  contentContract.onContentRegistered(callback);
  // TODO : test me
  onEnsContentHashChanged(callback);
}

main();
