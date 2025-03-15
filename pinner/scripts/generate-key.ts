import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const key = generatePrivateKey();
const account = privateKeyToAccount(key);

console.log(
  JSON.stringify(
    {
      privateKey: key,
      address: account.address.toLowerCase(),
    },
    null,
    2,
  ),
);

// bun build ./scripts/generate-key.ts --target bun --outfile ../bin/generate-key.js
