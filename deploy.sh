#!/usr/bin/env bash
# Deploy isochrone-map-reacher to production
# Usage: ./deploy.sh
set -e

DEST="/var/www/map-tool"

echo "→ Copying files to $DEST..."
sudo cp index.html "$DEST/index.html"

echo "→ Setting permissions..."
sudo chown www-data:www-data "$DEST/index.html" 2>/dev/null || true

echo "✓ Deployed to $DEST"
