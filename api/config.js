const {
  isAuthorized,
  readConfig,
  readJsonBody,
  writeConfig,
} = require('./_lib/config-store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const config = await readConfig();
      return res.status(200).json(config);
    }

    if (req.method === 'POST') {
      if (!isAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const body = await readJsonBody(req);
      const config = await writeConfig(body);
      return res.status(200).json({ ok: true, config });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[/api/config]', err);
    return res.status(500).json({ error: 'Internal error' });
  }
};
