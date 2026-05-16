import {
  Account,
  Address,
  Chain,
  ContractEventName,
  Hash,
  PublicClient,
  Transport,
  WalletClient,
  WatchContractEventOnLogsFn,
  WatchContractEventReturnType,
} from "viem";
import contentRegistryAbi from "./abi/contentRegistry.abi.js";
import defaultLogger from "../logger.js";

// How long to wait after a subscription error before re-subscribing.
const SUBSCRIPTION_RESTART_BACKOFF_MS = 5_000;

export class ContentRegistryContract {
  private _logger = defaultLogger.child({
    context: ContentRegistryContract.name,
  });

  private _publicClient: PublicClient;
  private _walletClient: WalletClient<Transport, Chain, Account>;
  private _contractAddress: Address;
  private _abi = contentRegistryAbi;

  constructor({
    contractAddress,
    publicClient,
    walletClient,
  }: {
    contractAddress: Address;
    publicClient: PublicClient;
    walletClient: WalletClient<Transport, Chain, Account>;
  }) {
    this._contractAddress = contractAddress;
    this._publicClient = publicClient;
    this._walletClient = walletClient;
  }

  get contractAddress() {
    return this._contractAddress;
  }

  async registerContent(CID: Hash, size: bigint, uploader: Address) {
    const { request } = await this._publicClient.simulateContract({
      address: this._contractAddress,
      abi: this._abi,
      functionName: "registerContent",
      args: [CID, size, uploader],
      account: this._walletClient.account,
    });
    const txHash = await this._walletClient.writeContract(request);
    const transactionReceipt =
      await this._publicClient.waitForTransactionReceipt({ hash: txHash });
    return transactionReceipt;
  }

  async confirmPin(CID: Hash) {
    const { request } = await this._publicClient.simulateContract({
      address: this._contractAddress,
      abi: this._abi,
      functionName: "confirmPin",
      args: [CID],
      account: this._walletClient.account,
    });
    const txHash = await this._walletClient.writeContract(request);
    const transactionReceipt =
      await this._publicClient.waitForTransactionReceipt({ hash: txHash });
    return transactionReceipt;
  }

  async getContentInfo(CID: Hash) {
    const content = await this._publicClient.readContract({
      address: this._contractAddress,
      abi: this._abi,
      functionName: "getContentInfo",
      args: [CID],
    });
    return content;
  }

  /**
   * Subscribe to a contract event.
   *
   * Wraps viem's watchContractEvent with an onError handler that logs the
   * error and re-establishes the subscription after a short backoff. Without
   * this, a transient RPC/WebSocket disruption can silently kill the
   * subscription — the pinner process keeps running but stops receiving
   * events, and on-chain content registrations are dropped forever.
   *
   * Returns an unwatch function. Calling it stops the subscription and
   * prevents further auto-restart.
   */
  watchEvent<E extends ContractEventName<typeof contentRegistryAbi>>(
    eventName: E,
    callback: WatchContractEventOnLogsFn<
      typeof contentRegistryAbi,
      E extends ContractEventName<typeof contentRegistryAbi>
        ? E
        : ContractEventName<typeof contentRegistryAbi>,
      true
    >,
  ): WatchContractEventReturnType {
    let currentUnwatch: WatchContractEventReturnType = () => {};
    let stopped = false;

    const subscribe = () => {
      if (stopped) return;
      this._logger.info({ eventName }, "Subscribing to contract event");
      currentUnwatch = this._publicClient.watchContractEvent({
        address: this._contractAddress,
        abi: this._abi,
        eventName: eventName,
        onLogs: callback,
        onError: (err) => {
          this._logger.error(
            { eventName, err },
            "watchContractEvent error; will re-subscribe",
          );
          try {
            currentUnwatch();
          } catch (teardownErr) {
            this._logger.warn(
              { teardownErr },
              "Error during subscription teardown",
            );
          }
          // Probe RPC liveness in the background; restart regardless.
          this._publicClient
            .getBlockNumber()
            .then((block) => {
              this._logger.info(
                { block: block.toString() },
                "RPC is reachable",
              );
            })
            .catch((rpcErr) => {
              this._logger.error(
                { rpcErr },
                "RPC also failing while restarting subscription",
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

  onContentRegistered(
    callback: (uploader: Address, cid: Hash) => Promise<unknown>,
  ) {
    return this.watchEvent("ContentRegistered", async (logs) => {
      for (const log of logs) {
        await callback(log.args.uploader, log.args.CID);
      }
    });
  }
}
