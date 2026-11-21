#!/bin/bash
# Regenerates the raster icon assets in frontend/public from the SVG sources.
#
# Sources:
#   public/favicon.svg  - tile mark (fixed dark colours: amber envelope on #0B0B0C)
#   public/logo.svg     - bare mark (fill="currentColor"; recoloured here as needed)
#
# Tools: rsvg-convert (librsvg) and ImageMagick (`magick`) must be on PATH.
# The generated files are committed, so builds don't depend on these tools.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC="$ROOT/public"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

DARK_BG='#0B0B0C'
DARK_ACCENT='#FFB000'

# PWA icons: rounded tile as-is (transparency preserved)
rsvg-convert -w 192 -h 192 "$PUBLIC/favicon.svg" -o "$PUBLIC/pwa-192x192.png"
rsvg-convert -w 512 -h 512 "$PUBLIC/favicon.svg" -o "$PUBLIC/pwa-512x512.png"

# Maskable icon: full-bleed dark square, envelope at 60% width centred in
# the central 80% safe zone. logo.svg is currentColor, so recolour a copy.
sed "s/currentColor/$DARK_ACCENT/" "$PUBLIC/logo.svg" > "$TMP/maskable-env.svg"
rsvg-convert -w 308 -h 308 "$TMP/maskable-env.svg" -o "$TMP/maskable-env.png"
magick -size 512x512 "xc:$DARK_BG" "$TMP/maskable-env.png" -gravity center -composite \
    "$PUBLIC/maskable-512x512.png"

# Apple touch icon: opaque tile, rounded corners filled with the dark background
rsvg-convert -b "$DARK_BG" -w 180 -h 180 "$PUBLIC/favicon.svg" -o "$PUBLIC/apple-touch-icon.png"

# favicon.ico: 32 + 16 multi-size, transparent tile. The 16px frame uses a
# pixel-tuned variant (larger envelope, heavier flap/eyes) so the ghost hem
# and eyes stay legible at favicon size.
rsvg-convert -w 32 -h 32 "$PUBLIC/favicon.svg" -o "$TMP/favicon-32.png"
cat > "$TMP/favicon-16.svg" <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="10" fill="#0B0B0C"/>
  <g transform="translate(32 32) scale(0.94) translate(-32 -32)">
    <path fill="#FFB000" d="M10 12h44a4 4 0 0 1 4 4v32l-5 5-5-5-5 5-5-5-5 5-5-5-5 5-5-5-5 5-5-5-4 4V16a4 4 0 0 1 4-4z"/>
    <path d="M10 18 32 35 54 18" fill="none" stroke="#0B0B0C" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="20" y="38" width="7" height="9" rx="1.5" fill="#0B0B0C"/>
    <rect x="37" y="38" width="7" height="9" rx="1.5" fill="#0B0B0C"/>
  </g>
</svg>
EOF
rsvg-convert -w 16 -h 16 "$TMP/favicon-16.svg" -o "$TMP/favicon-16.png"
magick "$TMP/favicon-32.png" "$TMP/favicon-16.png" "$PUBLIC/favicon.ico"

echo "Regenerated icons in $PUBLIC"
