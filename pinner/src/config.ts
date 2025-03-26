import { config as dotenvConfig } from "dotenv-flow";
import { Hex, isAddress } from "viem";
import { z } from "zod";

// Default configuration values
const DEFAULT_NODE_REGISTRY_ADDRESS =
  "0x49b3A52Db857BC3D16725b0Ec16f416cb341916b";
const DEFAULT_CONTENT_REGISTRY_ADDRESS =
  "0x183D99Ed54B29Bb10A5FB3AE101007d18f507202";
const DEFAULT_NETWORK = "baseSepolia";
const DEFAULT_CHAIN_URL =
  "https://summer-boldest-borough.base-sepolia.quiknode.pro/ee822abdf436718f3e9d93b1279a9898600e907f";
const DEFAULT_IPFS_HOST = "http://node:5001/api/v0";
const DEFAULT_PRIMARY_NODE_HOST = "node.webhash.com";

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

      NODE_REGISTRY_CONTRACT_ADDRESS: z
        .string()
        .refine(isAddress)
        .default(DEFAULT_NODE_REGISTRY_ADDRESS),
      CONTENT_REGISTRY_CONTRACT_ADDRESS: z
        .string()
        .refine(isAddress)
        .default(DEFAULT_CONTENT_REGISTRY_ADDRESS),
      NETWORK: z
        .enum(["localhost", "base", "baseSepolia"])
        .default(DEFAULT_NETWORK),
      CHAIN_URL: z.string().url().default(DEFAULT_CHAIN_URL),
      IPFS_HOST: z.string().url().default(DEFAULT_IPFS_HOST),

      PRIMARY_NODE_HOST: z.string().default(DEFAULT_PRIMARY_NODE_HOST),
    }),
  )
  .parse(process.env);
