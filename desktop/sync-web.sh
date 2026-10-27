#!/usr/bin/env bash
# Copies the static web UI into desktop/dist (bundled into the app; nothing is loaded remotely).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; root="$here/.."; out="$here/dist"
# Sentinel LOW-8: the shim lint runs on every sync/build, not only from an opt-in git hook.
bash "$here/shim/lint-shim.sh"
rm -rf "$out"; mkdir -p "$out"
cp "$root"/{index.html,app.js,styles.css} "$out/"
# Ship builds never embed the prototype catalog. Mock screenshot builds (PLEXUW_MOCK=true) keep data.js.
if [ "${PLEXUW_MOCK:-false}" = "true" ]; then
  cp "$root/data.js" "$out/data.js"
else
  printf '%s\n' 'window.__PLEXUW_SHIP=true;window.MOCK=[];window.COLLECTIONS=[];window.TV=[];window.EPISODES=[];' > "$out/data.js"
fi
cp -r "$root/assets" "$root/favicon" "$root/brand" "$out/"
rm -f "$out/assets/sample.mp4"
cp "$here/shim/desktop.css" "$out/"
# Sentinel LOW-16: fixture-only screenshot code is compiled out unless PLEXUW_MOCK=true
# (set it when syncing for a --features mockplex build).
# withGlobalTauri is false: bundle the shim with @tauri-apps/api from local node_modules (no CDN).
[ -d "$here/node_modules/@tauri-apps/api" ] || (cd "$here" && npm ci --ignore-scripts --no-audit --no-fund)
"$here/node_modules/.bin/esbuild" "$here/shim/desktop.js" --bundle --format=iife --target=es2020 --outfile="$out/desktop.js" --minify-syntax --define:__PLEXUW_MOCK__="${PLEXUW_MOCK:-false}" --log-level=warning
sed -i 's#</head>#<link rel="stylesheet" href="desktop.css"></head>#; s#</body>#<script src="desktop.js"></script></body>#' "$out/index.html"
echo "synced web UI -> $out"
