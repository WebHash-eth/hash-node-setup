import { CID } from "multiformats";
import {
  createPublicClient,
  createWalletClient,
  http,
  PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import config from "./config.js";
import { ContentRegistryContract } from "./contracts/contentRegistry.js";
import { pinContentToIpfs } from "./ipfs.js";

async function main() {
  console.log("Starting script...");
  const account = privateKeyToAccount(config.PRIVATE_KEY);

  const publicClient = createPublicClient({
    chain: chains[config.NETWORK],
    transport: http(config.CHAIN_URL),
  }) as PublicClient;

  const walletClient = createWalletClient({
    chain: chains[config.NETWORK],
    transport: http(config.CHAIN_URL),
    account,
  });

  const contentContract = new ContentRegistryContract({
    contractAddress: config.CONTENT_REGISTRY_CONTRACT_ADDRESS,
    publicClient,
    walletClient,
  });

  const chainId = await publicClient.getChainId();
  console.log("Chain ID:", chainId);

  contentContract.watchEvent("ContentRegistered", async (logs) => {
    for (const log of logs) {
      try {
        console.log("Executing event:", log);
        const hexCid = log.args.CID;
        const bytes = Buffer.from(
          hexCid.startsWith("0x") ? hexCid.slice(2) : hexCid,
          "hex",
        );
        const cid = CID.decode(bytes);
        console.log("CID:", cid.toString());
        const pinResult = await pinContentToIpfs(cid);
        console.log("Pinned content:", pinResult);
      } catch (error) {
        console.error("Watch event error", error);
      }
    }
  });
}

main();
