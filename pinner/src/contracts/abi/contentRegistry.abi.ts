export default [
  {
    inputs: [
      {
        internalType: "address",
        name: "_nodeRegistryAddress",
        type: "address",
      },
    ],
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
        internalType: "bytes",
        name: "CID",
        type: "bytes",
      },
      {
        indexed: true,
        internalType: "address",
        name: "node",
        type: "address",
      },
    ],
    name: "ContentPinned",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes",
        name: "CID",
        type: "bytes",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "size",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "uploader",
        type: "address",
      },
    ],
    name: "ContentRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes",
        name: "CID",
        type: "bytes",
      },
      {
        indexed: true,
        internalType: "address",
        name: "node",
        type: "address",
      },
    ],
    name: "ContentUnpinned",
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
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes",
        name: "CID",
        type: "bytes",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "nodes",
        type: "address[]",
      },
    ],
    name: "StorageNodesAssigned",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "_CID",
        type: "bytes",
      },
    ],
    name: "confirmPin",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "",
        type: "bytes",
      },
    ],
    name: "contentRegistry",
    outputs: [
      {
        internalType: "bytes",
        name: "CID",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "size",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "uploader",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "pinnedCount",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "_CID",
        type: "bytes",
      },
    ],
    name: "getContentInfo",
    outputs: [
      {
        components: [
          {
            internalType: "bytes",
            name: "CID",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "size",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "uploader",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "pinnedCount",
            type: "uint256",
          },
        ],
        internalType: "struct ContentRegistry.Content",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nodeRegistry",
    outputs: [
      {
        internalType: "contract NodeRegistry",
        name: "",
        type: "address",
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
    inputs: [
      {
        internalType: "bytes",
        name: "_CID",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "_size",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "_uploader",
        type: "address",
      },
    ],
    name: "registerContent",
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
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
