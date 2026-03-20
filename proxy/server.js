import 'dotenv/config';
import express from 'express';
import { createClient } from 'hafas-client';
import { profile as dbProfile } from 'hafas-client/p/db/index.js';

const app = express();
const PORT = process.env.PORT || 3001;
const ORS_KEY = process.env.ORS_API_KEY;
const ORS_BASE = 'https://api.openrouteservice.org/v2/isochrones/';

if (!ORS_KEY) {
  console.error('ERROR: ORS_API_KEY not set in .env');
  process.exit(1);
}

// hafas client for Deutsche Bahn
const hafas = createClient(dbProfile, 'reachmap/1.0 (eulenai.de)');

app.use(express.json());

// ── ORS isochrone proxy ──────────────────────────────────────────
const ALLOWED_PROFILES = [
  'cycling-regular', 'cycling-road', 'cycling-electric',
  'driving-car', 'foot-walking', 'foot-hiking',
];

app.post('/map-tool/api/isochrones/:profile', async (req, res) => {
  const { profile } = req.params;
  if (!ALLOWED_PROFILES.includes(profile)) {
    return res.status(400).json({ error: 'Invalid profile' });
  }

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

// ── Deutsche Bahn transit isochrone ─────────────────────────────
// Uses hafas reachableFrom() — ONE Hafas call per point.
// Returns list of reachable stops with transit time + remaining walk time.
// The frontend draws Turf walk circles around each stop.
app.post('/map-tool/api/transit-isochrone', async (req, res) => {
  const { lat, lng, totalMinutes, when } = req.body;

  if (typeof lat !== 'number' || typeof lng !== 'number' || typeof totalMinutes !== 'number') {
    return res.status(400).json({ error: 'Invalid body: lat, lng, totalMinutes required' });
  }
  if (totalMinutes < 1 || totalMinutes > 240) {
    return res.status(400).json({ error: 'totalMinutes must be 1–240' });
  }

  // Validate / default departure time
  let whenDate = when ? new Date(when) : new Date();
  if (isNaN(whenDate.getTime())) whenDate = new Date();
  // Don't allow times more than 24h in the past or 7 days in the future
  const now = Date.now();
  if (whenDate.getTime() < now - 24 * 3600 * 1000) whenDate = new Date();
  if (whenDate.getTime() > now + 7 * 24 * 3600 * 1000) whenDate = new Date(now + 7 * 24 * 3600 * 1000);

  try {
    const result = await hafas.reachableFrom(
      { type: 'location', latitude: lat, longitude: lng },
      {
        when: whenDate,
        maxTransfers: 3,
        duration: totalMinutes,
        language: 'de',
      }
    );

    // Build stop list — hafas returns duration in minutes
    const stops = result
      .filter(r => r.duration !== null && r.duration < totalMinutes)
      .map(r => ({
        name: r.stop.name,
        lat: r.stop.location.latitude,
        lng: r.stop.location.longitude,
        transitMinutes: Math.round(r.duration),
        remainingMinutes: totalMinutes - Math.round(r.duration),
      }))
      .filter(s => s.remainingMinutes >= 1)
      // Deduplicate by rounding coords to ~100m grid
      .filter((s, i, arr) => {
        const key = `${(s.lat * 1000).toFixed()}_${(s.lng * 1000).toFixed()}`;
        return arr.findIndex(t =>
          `${(t.lat * 1000).toFixed()}_${(t.lng * 1000).toFixed()}` === key
        ) === i;
      })
      .slice(0, 250);

    res.json({ stops, when: whenDate.toISOString(), totalMinutes });
  } catch (err) {
    console.error('HAFAS error:', err.message);
    res.status(502).json({ error: 'Transit data unavailable: ' + err.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`map-tool ORS proxy listening on 127.0.0.1:${PORT}`);
});
