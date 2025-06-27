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
} from "viem";
import contentRegistryAbi from "./abi/contentRegistry.abi.js";
import defaultLogger from "../logger.js";

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

  watchEvent<E extends ContractEventName<typeof contentRegistryAbi>>(
    eventName: E,
    callback: WatchContractEventOnLogsFn<
      typeof contentRegistryAbi,
      E extends ContractEventName<typeof contentRegistryAbi>
        ? E
        : ContractEventName<typeof contentRegistryAbi>,
      true
    >,
  ) {
    const unwatch = this._publicClient.watchContractEvent({
      address: this._contractAddress,
      abi: this._abi,
      eventName: eventName,
      onLogs: callback,
      onError: async (err) => {
        this._logger.error({
          msg: "Error watching contract event",
          meta: {
            eventName,
          },
          err,
        });
        // check if we can fetch the block number
        const block = await this._publicClient.getBlockNumber();
        this._logger.info(`Successfully Fetched block ${block}`);
      },
    });
    return unwatch;
  }

  onContentRegistered(
    callback: (uploader: Address, cid: Hash) => Promise<unknown>,
  ) {
    this.watchEvent("ContentRegistered", async (logs) => {
      for (const log of logs) {
        await callback(log.args.uploader, log.args.CID);
      }
    });
  }
}
