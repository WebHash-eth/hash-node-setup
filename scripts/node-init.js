import os from "os";

const address = process.argv[2];
const publicIp = process.argv[3];
const storage = process.argv[4];

if (!address || !publicIp || !storage) {
  console.error(
    "❌ Please provide address, publicIp as command-line arguments.",
  );
  process.exit(1);
}

// 🛠 Collect hardware information
const hardwareInfo = {
  hostname: os.hostname(),
  platform: os.platform(),
  arch: os.arch(),
  cpu: os.cpus().map((cpu) => cpu.model),
  memory: os.totalmem(), // Total memory only
  networkInterfaces: os.networkInterfaces(),
  uptime: os.uptime(),
  timestamp: new Date().toISOString(), // Required for schema validation
  storage, // Total disk space in KB
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
