import { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

let key = process.argv[2] as Hex;
if (!key.startsWith("0x")) {
  key = `0x${key}`;
}
const account = privateKeyToAccount(key);
console.log(
  JSON.stringify(
    {
      address: account.address,
      privateKey: key,
    },
    null,
    2,
  ),
);
