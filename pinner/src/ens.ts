import * as contentHash from "@ensdomains/content-hash";
import { varint } from "multiformats";
import {
  Address,
  bytesToHex,
  createPublicClient,
  Hash,
  hexToBytes,
  webSocket,
  WatchContractEventReturnType,
} from "viem";
import { mainnet } from "viem/chains";
import config from "./config.js";
import ensPublicResolverAbi from "./contracts/abi/ens.publicResolver.abi.js";
import defaultLogger from "./logger.js";

const logger = defaultLogger.child({ module: "ens" });

const ENS_PUBLIC_RESOLVER_CONTRACT_ADDRESS =
  "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63";

// How long to wait after a subscription error before re-subscribing.
const SUBSCRIPTION_RESTART_BACKOFF_MS = 5_000;

const wsTransport = webSocket(config.ETH_MAINNET_CHAIN_WS_URL, {
  reconnect: {
    attempts: Infinity,
  },
});

const publicClient = createPublicClient({
  chain: mainnet,
  transport: wsTransport,
});

/**
 * Subscribe to ENS ContenthashChanged events.
 *
 * Wraps viem's watchContractEvent with an onError handler that logs the
 * error and re-establishes the subscription after a short backoff. Without
 * this, a transient RPC/WebSocket disruption can silently kill the
 * subscription — the pinner process keeps running but stops receiving ENS
 * events, and content-hash updates are dropped forever.
 *
 * Returns an unwatch function. Calling it stops the subscription and
 * prevents further auto-restart.
 */
export function onEnsContentHashChanged(
  callback: (uploader: Address, cid: Hash) => Promise<void>,
): WatchContractEventReturnType {
  logger.info(
    `Watching ENS ContenthashChanged events with url: ${config.ETH_MAINNET_CHAIN_WS_URL.slice(0, 20)}...`,
  );

  let currentUnwatch: WatchContractEventReturnType = () => {};
  let stopped = false;

  const subscribe = () => {
    if (stopped) return;
    logger.info("Subscribing to ENS ContenthashChanged");
    currentUnwatch = publicClient.watchContractEvent({
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
      onError: (err) => {
        logger.error(
          { err },
          "ENS watchContractEvent error; will re-subscribe",
        );
        try {
          currentUnwatch();
        } catch (teardownErr) {
          logger.warn(
            { teardownErr },
            "Error during ENS subscription teardown",
          );
        }
        publicClient
          .getBlockNumber()
          .then((block) => {
            logger.info(
              { block: block.toString() },
              "Mainnet RPC is reachable",
            );
          })
          .catch((rpcErr) => {
            logger.error(
              { rpcErr },
              "Mainnet RPC also failing while restarting subscription",
            );
          });
        setTimeout(subscribe, SUBSCRIPTION_RESTART_BACKOFF_MS);
      },
    });
  };

  subscribe();

  return () => {
    stopped = true;
    try {
      currentUnwatch();
    } catch {
      // ignore teardown errors during shutdown
    }
  };
}
