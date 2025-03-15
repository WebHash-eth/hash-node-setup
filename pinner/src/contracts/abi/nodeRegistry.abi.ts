export default [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "nodeAddress",
        type: "address",
      },
    ],
    name: "NodeDeactivated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "nodeAddress",
        type: "address",
      },
    ],
    name: "NodeReactivated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "nodeAddress",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "peerId",
        type: "bytes",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "storageCapacity",
        type: "uint256",
      },
    ],
    name: "NodeRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "nodeAddress",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "peerId",
        type: "bytes",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "storageCapacity",
        type: "uint256",
      },
    ],
    name: "NodeUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    inputs: [],
    name: "contentRegistryAddress",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_nodeAddress",
        type: "address",
      },
    ],
    name: "deactivateNode",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_nodeAddress",
        type: "address",
      },
    ],
    name: "getNodeInfo",
    outputs: [
      {
        internalType: "address",
        name: "nodeAddress",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "peerId",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "storageCapacity",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "isActive",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "storageUsed",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "pinnedCIDsCount",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "nodes",
    outputs: [
      {
        internalType: "address",
        name: "nodeAddress",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "peerId",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "storageCapacity",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "isActive",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "storageUsed",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "pinnedCIDsCount",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "reactivateNode",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "_peerId",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "_storageCapacity",
        type: "uint256",
      },
    ],
    name: "registerNode",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_contentRegistryAddress",
        type: "address",
      },
    ],
    name: "setContentRegistryAddress",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "totalActiveNodes",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "_peerId",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "_storageCapacity",
        type: "uint256",
      },
    ],
    name: "updateNodeMetadata",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_nodeAddress",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_storageChange",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "_increase",
        type: "bool",
      },
    ],
    name: "updateNodeStorage",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
