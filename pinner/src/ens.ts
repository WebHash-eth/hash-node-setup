import * as contentHash from "@ensdomains/content-hash";
import { varint } from "multiformats";
import {
  Address,
  bytesToHex,
  createPublicClient,
  Hex,
  hexToBytes,
  webSocket,
} from "viem";
import { mainnet } from "viem/chains";
import config from "./config.js";
import ensPublicResolverAbi from "./contracts/abi/ens.publicResolver.abi.js";
import defaultLogger from "./logger.js";

const logger = defaultLogger.child({ module: "ens" });

const ENS_PUBLIC_RESOLVER_CONTRACT_ADDRESS =
  "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63";

const wsTransport = webSocket(config.ETH_MAINNET_CHAIN_WS_URL, {
  reconnect: {
    attempts: Infinity,
  },
});

const publicClient = createPublicClient({
  chain: mainnet,
  transport: wsTransport,
});

export async function onEnsContentHashChanged(
  callback: (uploader: Address, hexCid: Hex) => Promise<void>,
) {
  publicClient.watchContractEvent({
    abi: ensPublicResolverAbi,
    address: ENS_PUBLIC_RESOLVER_CONTRACT_ADDRESS,
    eventName: "ContenthashChanged",
    onLogs: async (logs) => {
      for (const log of logs) {
        const l = logger.child({ log, tx: log.transactionHash });
        l.info("Received ENS ContenthashChanged event");
        const args = log.args;
        const hash = args.hash;
        if (!hash || !args.node) {
          l.info("Skipping ENS ContenthashChanged event due to missing args");
          continue;
        }
        const tx = await publicClient.getTransactionReceipt({
          hash: log.transactionHash,
        });
        const uploader = tx.from;
        const codec = contentHash.getCodec(hash);
        if (codec !== "ipfs") {
          l.info({ codec }, `Skipping.. received ${codec} codec`);
          continue;
        }
        const bytes = hexToBytes(hash);
        const [, offset] = varint.decode(bytes);
        const value = bytes.slice(offset);
        const hexCid = bytesToHex(value);
        await callback(uploader, hexCid);
      }
    },
  });
}
