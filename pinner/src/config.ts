import { config as dotenvConfig } from "dotenv-flow";
import { Hex, isAddress } from "viem";
import { z } from "zod";

// Default configuration values
const DEFAULT_NODE_REGISTRY_ADDRESS =
  "0x85216f8b1b7bf3C0fF947dBb1a5b7c38C67d2437";
const DEFAULT_CONTENT_REGISTRY_ADDRESS =
  "0x6f7a486515c240893b7dDaa8B74d8c6601695BbB";
const DEFAULT_NETWORK = "baseSepolia";
const DEFAULT_IPFS_HOST = "http://node:5001/api/v0";

export default z
  .preprocess(
    () => {
      const env = dotenvConfig({ silent: true });
      // if (env.error) {
      //   throw env.error;
      // }
      return {
        ...process.env,
        ...env.parsed,
      };
    },
    z.object({
      PRIVATE_KEY: z.string().transform((val) => {
        const hexValue = val.startsWith("0x") ? val : `0x${val}`;
        return hexValue as Hex;
      }),
      CHAIN_WS_URL: z.string().url(),

      NODE_REGISTRY_CONTRACT_ADDRESS: z
        .string()
        .refine(isAddress)
        .default(DEFAULT_NODE_REGISTRY_ADDRESS),
      CONTENT_REGISTRY_CONTRACT_ADDRESS: z
        .string()
        .refine(isAddress)
        .default(DEFAULT_CONTENT_REGISTRY_ADDRESS),
      NETWORK: z
        .enum(["anvil", "localhost", "base", "baseSepolia"])
        .default(DEFAULT_NETWORK),
      IPFS_HOST: z.string().url().default(DEFAULT_IPFS_HOST),

      ETH_MAINNET_CHAIN_WS_URL: z.string().url(),
    }),
  )
  .parse(process.env);
