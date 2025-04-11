import os from "os";

const address = process.env.ADDRESS;
const publicIp = process.env.PUBLIC_IP;
const storage = process.env.STORAGE;
const version = process.env.VERSION;
const email = process.env.EMAIL;
const peerId = process.env.PEER_ID;

// Validate required environment variables
if (!address || !publicIp || !storage || !version || !email || !peerId) {
  console.error("❌ Missing required environment variables.");
  const missing = [
    !address && "ADDRESS",
    !publicIp && "PUBLIC_IP",
    !storage && "STORAGE",
    !version && "VERSION",
    !email && "EMAIL",
    !peerId && "PEER_ID",
  ]
    .filter(Boolean)
    .join(", ");
  console.error(`Missing: ${missing}`);
  process.exit(1);
}

// 🛠 Collect hardware information
const hardwareInfo = {
  hostname: os.hostname(),
  platform: os.platform(),
  arch: os.arch(),
  cpu: os.cpus().map((cpu) => cpu.model),
  memory: os.totalmem(),
  networkInterfaces: os.networkInterfaces(),
  uptime: os.uptime(),
  timestamp: new Date().toISOString(),
  storage,
};

const isLocal = process.env.NODE_ENV === "local";

const url = isLocal
  ? "http://localhost:6001/node"
  : "https://node.webhash.com/node";

try {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...hardwareInfo,
      address,
      publicIp,
      nodeVersion: version,
      email,
      peerId,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("❌ Failed to initialize node:", error);
  process.exit(1);
}
