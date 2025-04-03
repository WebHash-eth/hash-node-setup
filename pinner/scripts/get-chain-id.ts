import { createPublicClient, webSocket } from "viem";

async function main() {
  const wsUrl = process.argv[2];

  if (!wsUrl) {
    process.exit(1);
  }
  try {
    const socket = webSocket(wsUrl);
    const client = createPublicClient({
      transport: socket,
    });

    const chainId = await client.getChainId();
    console.log(chainId);
    const rpc = await client.transport.getRpcClient();
    rpc.close();
    process.exit(0);
  } catch (error) {
    console.error(`Error getting chain ID from ${wsUrl}:`, error);
    process.exit(1);
  }
}

main();
