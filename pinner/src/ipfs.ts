import { CID } from "multiformats";
import config from "./config.js";
import pRetry from "p-retry";

export async function pinContentToIpfs(cid: CID) {
  return pRetry(
    async () => {
      const res = await fetch(
        `${config.IPFS_HOST}/pin/add?arg=${cid.toString()}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!res.ok) {
        throw new Error(
          `Failed to pin content: ${res.statusText}: ${await res.text()}`,
        );
      }

      return res.json();
    },
    {
      retries: 5,
      factor: 2,
      minTimeout: 10_000, // first retry after 10 seconds
      maxTimeout: 60_000,
      randomize: true,
      onFailedAttempt: (error) => {
        console.error(
          `Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
          error.message,
        );
      },
    },
  );
}
