import { bases } from "multiformats/basics";
import {
  Account,
  Address,
  Chain,
  Hash,
  PublicClient,
  Transport,
  WalletClient,
  createPublicClient,
  createWalletClient,
  http,
  toHex,
} from "viem";
import nodeRegistryAbi from "./abi/nodeRegistry.abi.js";

export class NodeRegistryContract {
  private _publicClient: PublicClient;
  private _walletClient: WalletClient<Transport, Chain, Account>;
  private _contractAddress: Address;
  private _abi = nodeRegistryAbi;

  constructor({
    contractAddress,
    chain,
    account,
  }: {
    contractAddress: Address;
    chain: Chain;
    account: Account;
  }) {
    this._contractAddress = contractAddress;
    this._publicClient = createPublicClient({
      chain,
      transport: http(),
    });
    this._walletClient = createWalletClient({
      chain,
      transport: http(),
      account,
    });
  }

  get contractAddress() {
    return this._contractAddress;
  }

  async setContentRegistryAddress(contentRegistryAddress: Address) {
    const { request } = await this._publicClient.simulateContract({
      address: this._contractAddress,
      abi: this._abi,
      functionName: "setContentRegistryAddress",
      args: [contentRegistryAddress],
      account: this._walletClient.account,
    });
    const txHash = await this._walletClient.writeContract(request);
    const transactionReceipt =
      await this._publicClient.waitForTransactionReceipt({ hash: txHash });
    return transactionReceipt;
  }

  async registerNode(peerId: string, storageCapacity: bigint) {
    const bytes = bases.base58btc.decode(`z${peerId}`);
    const peerIdMultihash = toHex(bytes);

    const { request } = await this._publicClient.simulateContract({
      address: this._contractAddress,
      abi: this._abi,
      functionName: "registerNode",
      args: [peerIdMultihash, storageCapacity],
      account: this._walletClient.account,
    });
    const txHash = await this._walletClient.writeContract(request);
    const transactionReceipt =
      await this._publicClient.waitForTransactionReceipt({ hash: txHash });
    return transactionReceipt;
  }

  async updateNodeMetadata(peerId: Hash, storageCapacity: bigint) {
    const { request } = await this._publicClient.simulateContract({
      address: this._contractAddress,
      abi: this._abi,
      functionName: "updateNodeMetadata",
      args: [peerId, storageCapacity],
      account: this._walletClient.account,
    });
    const txHash = await this._walletClient.writeContract(request);
    const transactionReceipt =
      await this._publicClient.waitForTransactionReceipt({ hash: txHash });
    return transactionReceipt;
  }

  async getNodeInfo(nodeAddress: Address) {
    const nodeInfo = await this._publicClient.readContract({
      address: this._contractAddress,
      abi: this._abi,
      functionName: "getNodeInfo",
      args: [nodeAddress],
    });
    return nodeInfo;
  }

  async deactivateNode(nodeAddress: Address) {
    const { request } = await this._publicClient.simulateContract({
      address: this._contractAddress,
      abi: this._abi,
      functionName: "deactivateNode",
      args: [nodeAddress],
      account: this._walletClient.account,
    });
    const txHash = await this._walletClient.writeContract(request);
    const transactionReceipt =
      await this._publicClient.waitForTransactionReceipt({ hash: txHash });
    return transactionReceipt;
  }

  async reactivateNode() {
    const { request } = await this._publicClient.simulateContract({
      address: this._contractAddress,
      abi: this._abi,
      functionName: "reactivateNode",
      args: [],
      account: this._walletClient.account,
    });
    const txHash = await this._walletClient.writeContract(request);
    const transactionReceipt =
      await this._publicClient.waitForTransactionReceipt({ hash: txHash });
    return transactionReceipt;
  }
}
