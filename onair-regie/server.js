import express from "express";
import fs from "fs";
import os from "os";
import path from "path";

const app = express();

const PORT = process.env.PORT || 8081;
const PUBLIC_DIR = path.resolve("./public");
const STATE_FILE = path.join(PUBLIC_DIR, "onair.json");
const CONFIG_FILE = path.join(PUBLIC_DIR, "config.json");

const DEFAULT_STATE = Object.freeze({
  onair: false,
  startedAt: null,
  updatedAt: null,
});

const DEFAULT_SECONDARY_CLOCKS = Object.freeze([
  Object.freeze({ label: "Kourou", timeZone: "America/Cayenne" }),
  Object.freeze({ label: "Cape Canaveral (ET)", timeZone: "America/New_York" }),
  Object.freeze({ label: "UTC", timeZone: "UTC" }),
  Object.freeze({ label: "Paris", timeZone: "Europe/Paris" }),
]);

const DEFAULT_CONFIG = Object.freeze({
  showTitle: "ESA - CREW12",
  primaryTimeZone: "Europe/Paris",
  primaryTimeZoneLabel: "Europe/Paris",
  secondaryClocks: DEFAULT_SECONDARY_CLOCKS,
});

const MAX_SECONDARY_CLOCKS = 8;

app.use(express.json());

function cloneSecondaryClocks(clocks = DEFAULT_SECONDARY_CLOCKS) {
  return clocks.map((clock) => ({ ...clock }));
}

function cloneDefaultConfig() {
  return {
    showTitle: DEFAULT_CONFIG.showTitle,
    primaryTimeZone: DEFAULT_CONFIG.primaryTimeZone,
    primaryTimeZoneLabel: DEFAULT_CONFIG.primaryTimeZoneLabel,
    secondaryClocks: cloneSecondaryClocks(DEFAULT_SECONDARY_CLOCKS),
  };
}

function ensureDataFiles() {
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) writeJsonFile(STATE_FILE, DEFAULT_STATE);
  if (!fs.existsSync(CONFIG_FILE)) writeJsonFile(CONFIG_FILE, cloneDefaultConfig());
}

function writeJsonFile(filePath, payload) {
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf-8");
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  fs.renameSync(tmp, filePath);
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf-8");
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidTimeZone(timeZone) {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function normalizeState(input = {}) {
  return {
    onair: !!input.onair,
    startedAt: input.startedAt || null,
    updatedAt: input.updatedAt || null,
  };
}

function normalizeClock(input) {
  const requestedTimeZone = normalizeText(
    input?.timeZone
      || input?.timezone
      || input?.tz
  );

  if (!isValidTimeZone(requestedTimeZone)) return null;

  const label = normalizeText(
    input?.label
      || input?.name
      || input?.city
      || input?.title
  ) || requestedTimeZone;

  return {
    label,
    timeZone: requestedTimeZone,
  };
}

function normalizeSecondaryClocks(input) {
  if (!Array.isArray(input)) return cloneSecondaryClocks(DEFAULT_SECONDARY_CLOCKS);

  const clocks = input
    .map((clock) => normalizeClock(clock))
    .filter(Boolean)
    .slice(0, MAX_SECONDARY_CLOCKS);

  return clocks.length ? clocks : cloneSecondaryClocks(DEFAULT_SECONDARY_CLOCKS);
}

function normalizeConfig(input = {}) {
  const defaults = cloneDefaultConfig();
  const showTitle = normalizeText(input.showTitle) || defaults.showTitle;

  const requestedTimeZone = normalizeText(
    input.primaryTimeZone
      || input.primaryTimezone
      || input.timeZone
      || input.timezone
  );

  const primaryTimeZone = isValidTimeZone(requestedTimeZone)
    ? requestedTimeZone
    : defaults.primaryTimeZone;

  const primaryTimeZoneLabel = normalizeText(
    input.primaryTimeZoneLabel
      || input.primaryTimezoneLabel
      || input.timeZoneLabel
      || input.timezoneLabel
      || input.timeZoneName
      || input.timezoneName
  ) || primaryTimeZone;

  const secondaryClocks = normalizeSecondaryClocks(
    input.secondaryClocks || input.clocks
  );

  return {
    showTitle,
    primaryTimeZone,
    primaryTimeZoneLabel,
    secondaryClocks,
  };
}

function readState() {
  return normalizeState(readJsonFile(STATE_FILE, DEFAULT_STATE));
}

function readConfig() {
  return normalizeConfig(readJsonFile(CONFIG_FILE, cloneDefaultConfig()));
}

function writeState(onair) {
  const previous = readState();
  const now = new Date().toISOString();
  const payload = normalizeState({
    onair: !!onair,
    startedAt: onair ? (previous.onair && previous.startedAt ? previous.startedAt : now) : null,
    updatedAt: now,
  });

  writeJsonFile(STATE_FILE, payload);
  return payload;
}

function writeConfig(input) {
  const payload = normalizeConfig(input);
  writeJsonFile(CONFIG_FILE, payload);
  return payload;
}

function extractToken(req) {
  return req.query?.token
    || (req.headers.authorization ?? "").replace("Bearer ", "").trim();
}

function isAuthorized(req) {
  if (!process.env.ONAIR_TOKEN) return true;
  const token = extractToken(req);
  return !!token && token === process.env.ONAIR_TOKEN;
}

function setApiHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

ensureDataFiles();

app.options("/api/config", (req, res) => {
  setApiHeaders(res);
  res.status(200).end();
});

app.get("/api/state", (req, res) => {
  setApiHeaders(res);
  res.json(readState());
});

app.get("/api/config", (req, res) => {
  setApiHeaders(res);
  res.json(readConfig());
});

app.post("/api/config", (req, res) => {
  setApiHeaders(res);

  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const config = writeConfig(req.body ?? {});
    res.json({ ok: true, config });
  } catch (err) {
    console.error("Erreur /api/config:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

app.get("/onair/on", (req, res) => {
  try {
    writeState(true);
    res.type("text/plain").send("OK ON-AIR=ON\n");
  } catch (err) {
    console.error("Erreur /onair/on:", err);
    res.status(500).type("text/plain").send("ERROR\n");
  }
});

app.get("/onair/off", (req, res) => {
  try {
    writeState(false);
    res.type("text/plain").send("OK ON-AIR=OFF\n");
  } catch (err) {
    console.error("Erreur /onair/off:", err);
    res.status(500).type("text/plain").send("ERROR\n");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  const interfaces = os.networkInterfaces();
  const ips = Object.values(interfaces)
    .flatMap((value) => value ?? [])
    .filter((item) => item.family === "IPv4" && !item.internal)
    .map((item) => item.address);

  const baseUrls = [`http://localhost:${PORT}/`, ...ips.map((ip) => `http://${ip}:${PORT}/`)];
  const uniqueBaseUrls = [...new Set(baseUrls)];

  console.log("Acces (page) :");
  for (const url of uniqueBaseUrls) console.log(`- ${url}`);
  console.log("Admin :");
  for (const url of uniqueBaseUrls) console.log(`- ${url}admin`);
  console.log("API :");
  for (const url of uniqueBaseUrls) {
    console.log(`- ${url}api/state  |  ${url}api/config  |  ${url}onair/on  |  ${url}onair/off`);
  }
});
