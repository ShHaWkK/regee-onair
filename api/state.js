// GET /api/state - returns the current ON-AIR state.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    assertUpstashEnv();
    const upstashRes = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/onair`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
    });

    if (!upstashRes.ok) throw new Error(`Upstash ${upstashRes.status}`);

    const { result } = await upstashRes.json();
    const state = result
      ? JSON.parse(result)
      : { onair: false, startedAt: null, updatedAt: null };

    // Pas de cache CDN : le client doit toujours recevoir l'état le plus récent.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(state);
  } catch (err) {
    console.error('[/api/state]', err);
    return res.status(500).json({ error: 'Internal error' });
  }
};

function assertUpstashEnv() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  }
}
