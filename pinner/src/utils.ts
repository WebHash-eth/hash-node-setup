import logger from "./logger.js";

export function withErrorLogger<Args extends unknown[], Ret>(
  callback: (...args: Args) => Promise<Ret>,
) {
  return async (...args: Args): Promise<Ret | void> => {
    try {
      const res = await callback(...args);
      return res;
    } catch (err) {
      logger.error({ err }, `Error executing ${callback.name}`);
    }
  };
}

export class CIDProcessingState {
  private cids: Set<string> = new Set();

  add(cid: string) {
    this.cids.add(cid);

    setTimeout(() => {
      this.cids.delete(cid);
    }, 3_00_000); // 5 minutes
  }

  has(cid: string) {
    return this.cids.has(cid);
  }
}

export const cidProcessingState = new CIDProcessingState();
