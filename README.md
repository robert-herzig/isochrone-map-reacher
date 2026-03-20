# isochrone-map-reacher

A self-hosted reachability map tool running at `eulenai.de/map-tool`.

## What it does

Place one or more named points on an OpenStreetMap-based map, pick a transport mode and a maximum travel time, and instantly see the reachable area as an isochrone polygon. When multiple points are placed, the **intersection** (golden zone) shows where you can reach from *all* points within the time limit.

## Features

- 🗺️ **OSM + CartoDB dark tiles** via Leaflet
- 🚴 **6 transport modes**: bike, road bike, e-bike, car, walking, hiking
- ⏱️ **Time slider** 5–120 min with quick presets
- 🔶 **Intersection zone** computed client-side via Turf.js (no extra API calls)
- 💾 **Named setups** saved to localStorage — survives page reloads
- 🖱️ **Draggable markers** — reposition points after placing them

## Routing API

Uses **[OpenRouteService](https://openrouteservice.org/)** (free tier, 2,000 isochrone requests/day).  
Get a free API key at https://openrouteservice.org/dev/#/signup and paste it into the key field on first use. The key is stored in localStorage.

## Tech stack

- Pure vanilla JS (no build step)
- [Leaflet 1.9](https://leafletjs.com/) — map rendering
- [Turf.js 6.5](https://turfjs.org/) — client-side polygon intersection
- [OpenRouteService v2 Isochrones API](https://openrouteservice.org/dev/#/api-docs/v2/isochrones/{profile}/post)
- Fonts: Syne + DM Mono via Google Fonts

## Deployment

Served as a static file by nginx at `eulenai.de/map-tool`.

```
# nginx location block (in eulenai site config)
location = /map-tool {
    return 301 /map-tool/;
}
location /map-tool/ {
    alias /var/www/map-tool/;
    index index.html;
    try_files $uri $uri/ /map-tool/index.html;
}
```

To deploy after changes:

```bash
./deploy.sh
```
