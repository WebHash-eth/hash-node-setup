import { CID } from "multiformats";
import {
  Address,
  createPublicClient,
  createWalletClient,
  Hash,
  Hex,
  hexToBigInt,
  hexToNumber,
  http,
  Log,
  parseEventLogs,
  PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import config from "./config.js";
import contentRegistryAbi from "./contracts/abi/contentRegistry.abi.js";
import { ContentRegistryContract } from "./contracts/contentRegistry.js";
import { pinContentToIpfs } from "./ipfs.js";
import { WebSocketClient } from "./websocket.js";

interface RawLog {
  address: Address;
  blockHash: Hash;
  blockNumber: Hex;
  data: Hex;
  logIndex: Hex;
  removed: boolean;
  topics: Log["topics"];
  transactionHash: Hash;
  transactionIndex: Hex;
}

type WebsocketEventsData =
  | {
      type: "connected";
      data: {
        address: string;
        timestamp: string;
      };
    }
  | {
      type: "contract_event";
      data: RawLog | RawLog[];
    };

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

function parseEvent(eventData: RawLog | RawLog[]) {
  let logs: Log[];
  if (Array.isArray(eventData)) {
    logs = eventData.map((event) => ({
      ...event,
      blockNumber: hexToBigInt(event.blockNumber),
      logIndex: hexToNumber(event.logIndex),
      transactionIndex: hexToNumber(event.transactionIndex),
    }));
  } else {
    logs = [
      {
        ...eventData,
        blockNumber: hexToBigInt(eventData.blockNumber),
        logIndex: hexToNumber(eventData.logIndex),
        transactionIndex: hexToNumber(eventData.transactionIndex),
      },
    ];
  }
  const events = parseEventLogs({
    abi: contentRegistryAbi,
    logs,
  });
  return events;
}

async function handleWsContractEvent(data: RawLog | RawLog[]) {
  const logs = parseEvent(data);
  for (const log of logs) {
    console.log("Executing event:", log);
    if (log.eventName === "ContentRegistered") {
      const hexCid = log.args.CID;
      const bytes = Buffer.from(
        hexCid.startsWith("0x") ? hexCid.slice(2) : hexCid,
        "hex",
      );
      const cid = CID.decode(bytes);
      console.log("Parsed CID:", cid.toString());
      const pinResult = await pinContentToIpfs(cid);
      console.log("Pinned content:", pinResult);

      const tx = await contentContract.confirmPin(hexCid);
      console.log("Confirmed pin:", tx.transactionHash);
    }
  }
}

async function handleWsEvent(message: MessageEvent) {
  const event = JSON.parse(message.data) as WebsocketEventsData;
  try {
    if (event.type === "contract_event") {
      await handleWsContractEvent(event.data);
    }
  } catch (err) {
    console.error("Error handling websocket event", err, message);
  }
}

async function main() {
  console.log("Starting script...");

  const url = new URL(`wss://${config.PRIMARY_NODE_HOST}/ws`);
  url.searchParams.set("address", account.address);
  const client = new WebSocketClient({
    messageHandler: handleWsEvent,
    url,
  });
  client.connect();
}

main();
