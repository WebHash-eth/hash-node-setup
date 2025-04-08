import { CID } from "multiformats";
import pRetry from "p-retry";
import {
  Address,
  createPublicClient,
  createWalletClient,
  Hash,
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
import { cidProcessingState, withErrorLogger } from "./utils.js";

const wsTransport = webSocket(config.CHAIN_WS_URL, {
  reconnect: {
    attempts: Infinity,
  },
});

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

async function waitForContentRegister(cid: Hash) {
  return pRetry(
    async (attempt) => {
      logger.info({ cid, attempt }, "Fetching content info");
      const content = await contentContract.getContentInfo(cid);
      logger.info({ content }, `Fetch content for ${cid}`);
      return content;
    },
    {
      // // only retry if the error is content not registered
      // shouldRetry: (err) => {
      //   return (
      //     err instanceof ContractFunctionExecutionError &&
      //     err.message.includes("Content not registered")
      //   );
      // },
      retries: 10,
      minTimeout: 10_000, // 10 sec
      factor: 10,
      maxTimeout: 300_000, // 5 min
    },
  );
}

async function registerContent(
  uploader: Address,
  cid: Hash,
  waitForContent = false,
) {
  if (cidProcessingState.has(cid)) {
    logger.info({ cid }, "Skipping content registration: already processing");
    return;
  }
  cidProcessingState.add(cid);
  const parsedCid = CID.decode(hexToBytes(cid));

  logger.info({ uploader, cid: parsedCid }, "Pinning content");
  const pinResult = await pinContentToIpfs(parsedCid);
  logger.info({ pinResult }, "Pinned content to IPFS");

  if (waitForContent) {
    await waitForContentRegister(cid);
  }
  const tx = await contentContract.confirmPin(cid);
  logger.info({ tx: tx.transactionHash }, "Confirmed pin on-chain");
}

async function main() {
  logger.info("Starting pinner service...");

  const ensCallback = withErrorLogger((uploader: Address, cid: Hash) => {
    return registerContent(uploader, cid, true);
  });

  logger.info(
    `Watching ContentRegistered event with url: ${config.CHAIN_WS_URL.slice(0, 20)}...`,
  );
  contentContract.onContentRegistered(withErrorLogger(registerContent));
  onEnsContentHashChanged(ensCallback);
}

main();
