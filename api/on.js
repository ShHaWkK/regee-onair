// GET /api/on?token=SECRET  - compatible hardware (ATEM, macros, curl...)
// POST /api/on  Authorization: Bearer SECRET
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.query?.token
    || (req.headers['authorization'] ?? '').replace('Bearer ', '').trim();

  if (!token || token !== process.env.ONAIR_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    assertUpstashEnv();
    const now = new Date().toISOString();

    // Preserve startedAt if already ON-AIR.
    let startedAt = now;
    const existing = await upstashGet('onair');
    if (existing) {
      const prev = JSON.parse(existing);
      if (prev.onair && prev.startedAt) startedAt = prev.startedAt;
    }

    const state = { onair: true, startedAt, updatedAt: now };
    await upstashSet('onair', JSON.stringify(state));

    return res.status(200).json({ ok: true, state });
  } catch (err) {
    console.error('[/api/on]', err);
    return res.status(500).json({ error: 'Internal error' });
  }
};

function assertUpstashEnv() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  }
}

async function upstashGet(key) {
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Upstash GET ${res.status}`);
  const data = await res.json();
  return data.result ?? null;
}

async function upstashSet(key, value) {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['SET', key, value]),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
}
