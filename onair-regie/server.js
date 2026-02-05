import express from "express";
import fs from "fs";
import os from "os";
import path from "path";

const app = express();

const PORT = process.env.PORT || 8081;
const PUBLIC_DIR = path.resolve("./public");
const STATE_FILE = path.join(PUBLIC_DIR, "onair.json");

function ensureStateFile() {
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    writeState(false);
  }
}

function writeState(onair) {
  const payload = JSON.stringify(
    { onair: !!onair, updatedAt: new Date().toISOString() },
    null,
    2
  );

  const tmp = STATE_FILE + ".tmp";
  fs.writeFileSync(tmp, payload, "utf-8");
  fs.renameSync(tmp, STATE_FILE);
}

ensureStateFile();

app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

app.get("/onair/on", (req, res) => {
  try {
    writeState(true);
    res.type("text/plain").send("OK ON-AIR=ON\n");
  } catch {
    res.status(500).type("text/plain").send("ERROR\n");
  }
});

app.get("/onair/off", (req, res) => {
  try {
    writeState(false);
    res.type("text/plain").send("OK ON-AIR=OFF\n");
  } catch {
    res.status(500).type("text/plain").send("ERROR\n");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  const interfaces = os.networkInterfaces();
  const ips = Object.values(interfaces)
    .flatMap((v) => v ?? [])
    .filter((i) => i.family === "IPv4" && !i.internal)
    .map((i) => i.address);

  const baseUrls = [`http://localhost:${PORT}/`, ...ips.map((ip) => `http://${ip}:${PORT}/`)];
  const uniqueBaseUrls = [...new Set(baseUrls)];

  console.log("Accès (page) :");
  for (const url of uniqueBaseUrls) console.log(`- ${url}`);
  console.log("API :");
  for (const url of uniqueBaseUrls) console.log(`- ${url}onair/on  |  ${url}onair/off`);
});
