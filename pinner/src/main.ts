import { CID } from "multiformats";
import {
  createPublicClient,
  createWalletClient,
  PublicClient,
  webSocket,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import config from "./config.js";
import { ContentRegistryContract } from "./contracts/contentRegistry.js";
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

async function main() {
  logger.info("Starting pinner service...");

  contentContract.watchEvent("ContentRegistered", async (logs) => {
    for (const log of logs) {
      const logContext = { event: log };
      try {
        logger.info(logContext, "Processing ContentRegistered event");
        const hexCid = log.args.CID;
        const bytes = Buffer.from(
          hexCid.startsWith("0x") ? hexCid.slice(2) : hexCid,
          "hex",
        );
        const cid = CID.decode(bytes);
        logger.info({ ...logContext, cid: cid.toString() }, "Decoded CID");
        const pinResult = await pinContentToIpfs(cid);
        logger.info({ ...logContext, pinResult }, "Pinned content to IPFS");
        const tx = await contentContract.confirmPin(hexCid);
        logger.info(
          { ...logContext, transactionHash: tx.transactionHash },
          "Confirmed pin on-chain",
        );
      } catch (error) {
        logger.error({ ...logContext, err: error }, "Error processing event");
      }
    }
  });
}

main();
