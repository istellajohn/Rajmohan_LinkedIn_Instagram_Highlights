#!/usr/bin/env bash
# Rebuild the VALENCE type library: every Fontshare (Indian Type Foundry) family,
# a curated set of modern Google Fonts, and Vercel's Geist. Installs system-wide.
# Usage: sudo bash tools/fonts/install-fonts.sh   (about 260 MB download)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
DEST="${FONT_DEST:-/usr/local/share/fonts}"
mkdir -p "$DEST/fontshare" "$DEST/google" "$DEST/geist" "$WORK/zips" "$WORK/unz" "$WORK/google"

echo "Fontshare catalogue..."
for off in 0 100 200; do
  curl -sS "https://api.fontshare.com/v2/fonts?limit=100&offset=$off" \
    | python3 -I -c 'import json,sys; [print(f["slug"]) for f in json.load(sys.stdin).get("fonts",[])]'
done | sort -u > "$WORK/slugs.txt"
xargs -P 8 -I{} curl -sS --max-time 120 -o "$WORK/zips/{}.zip" "https://api.fontshare.com/v2/fonts/download/{}" < "$WORK/slugs.txt"
for z in "$WORK"/zips/*.zip; do
  n="$(basename "$z" .zip)"; mkdir -p "$WORK/unz/$n"
  python3 -I -c 'import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' "$z" "$WORK/unz/$n" || continue
  if find "$WORK/unz/$n" -iname "*.otf" ! -ipath "*variable*" | grep -q .; then
    find "$WORK/unz/$n" -iname "*.otf" ! -ipath "*variable*" -exec cp {} "$DEST/fontshare/" \;
  else
    find "$WORK/unz/$n" -iname "*.ttf" ! -ipath "*variable*" -exec cp {} "$DEST/fontshare/" \;
  fi
done

echo "Google Fonts..."
cp "$HERE/gf-families.txt" "$WORK/"
python3 -I "$HERE/gf_fetch.py" "$WORK"
cp -r "$WORK/google/"* "$DEST/google/"

echo "Geist..."
TARBALL="$(curl -sS https://registry.npmjs.org/geist/latest | python3 -I -c 'import json,sys; print(json.load(sys.stdin)["dist"]["tarball"])')"
curl -sS -o "$WORK/geist.tgz" "$TARBALL" && mkdir -p "$WORK/geist" && tar -xzf "$WORK/geist.tgz" -C "$WORK/geist"
find "$WORK/geist" -name "*.ttf" ! -iname "*variable*" -exec cp {} "$DEST/geist/" \;

fc-cache -f >/dev/null 2>&1 || true
echo "Installed families: $(fc-list --format='%{family[0]}\n' | sort -u | wc -l)"
rm -rf "$WORK"
