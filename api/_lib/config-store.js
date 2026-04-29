const DEFAULT_SECONDARY_CLOCKS = Object.freeze([
  Object.freeze({ label: 'Kourou', timeZone: 'America/Cayenne' }),
  Object.freeze({ label: 'Cape Canaveral (ET)', timeZone: 'America/New_York' }),
  Object.freeze({ label: 'UTC', timeZone: 'UTC' }),
  Object.freeze({ label: 'Paris', timeZone: 'Europe/Paris' }),
]);

const DEFAULT_CONFIG = Object.freeze({
  showTitle: 'ESA - CREW12',
  primaryTimeZone: 'Europe/Paris',
  primaryTimeZoneLabel: 'Europe/Paris',
  secondaryClocks: DEFAULT_SECONDARY_CLOCKS,
});

const CONFIG_KEY = 'onair_config';
const MAX_SECONDARY_CLOCKS = 8;

module.exports = {
  DEFAULT_CONFIG,
  isAuthorized,
  normalizeConfig,
  readConfig,
  readJsonBody,
  writeConfig,
};

function extractToken(req) {
  return req.query?.token
    || (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();
}

function isAuthorized(req) {
  const token = extractToken(req);
  return !!token && token === process.env.ONAIR_TOKEN;
}

function assertUpstashEnv() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  }
}

async function upstashGet(key) {
  assertUpstashEnv();
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
  });

  if (!res.ok) throw new Error(`Upstash GET ${res.status}`);

  const data = await res.json();
  return data.result ?? null;
}

async function upstashSet(key, value) {
  assertUpstashEnv();
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['SET', key, value]),
  });

  if (!res.ok) throw new Error(`Upstash SET ${res.status}`);
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidTimeZone(timeZone) {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone });
    return true;
  } catch {
    return false;
  }
}

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

async function readConfig() {
  const raw = await upstashGet(CONFIG_KEY);
  if (!raw) return cloneDefaultConfig();

  try {
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return cloneDefaultConfig();
  }
}

async function writeConfig(input) {
  const config = normalizeConfig(input);
  await upstashSet(CONFIG_KEY, JSON.stringify(config));
  return config;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    return req.body.trim() ? JSON.parse(req.body) : {};
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf8').trim();
  return text ? JSON.parse(text) : {};
}
