require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;
const ORS_KEY = process.env.ORS_API_KEY;
const ORS_BASE = 'https://api.openrouteservice.org/v2/isochrones/';

if (!ORS_KEY) {
  console.error('ERROR: ORS_API_KEY not set in .env');
  process.exit(1);
}

app.use(express.json());

// Only allow POST to /map-tool/api/isochrones/:profile
app.post('/map-tool/api/isochrones/:profile', async (req, res) => {
  const { profile } = req.params;

  // Validate profile against known ORS profiles to prevent SSRF
  const ALLOWED_PROFILES = [
    'cycling-regular', 'cycling-road', 'cycling-electric',
    'driving-car', 'foot-walking', 'foot-hiking',
  ];
  if (!ALLOWED_PROFILES.includes(profile)) {
    return res.status(400).json({ error: 'Invalid profile' });
  }

  // Validate body: only pass through known-safe fields
  const { locations, range, range_type, smoothing } = req.body;
  if (!Array.isArray(locations) || !Array.isArray(range)) {
    return res.status(400).json({ error: 'Invalid body' });
  }

  const body = JSON.stringify({ locations, range, range_type, smoothing });

  try {
    const response = await fetch(`${ORS_BASE}${profile}`, {
      method: 'POST',
      headers: {
        'Authorization': ORS_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json, application/geo+json',
      },
      body,
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(`ORS ${response.status} for ${profile}:`, JSON.stringify(data));
    }
    res.status(response.status).json(data);
  } catch (err) {
    console.error('ORS proxy error:', err.message);
    res.status(502).json({ error: 'Upstream request failed' });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`map-tool ORS proxy listening on 127.0.0.1:${PORT}`);
});
