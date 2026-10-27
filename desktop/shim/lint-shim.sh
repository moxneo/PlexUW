#!/usr/bin/env bash
# §6a M1: server strings must never reach an HTML sink. plex-browse.js may not use any
# HTML sink; desktop.js may only assign innerHTML from literals/static icon templates.
set -euo pipefail
cd "$(dirname "$0")"
bad=0
if rg -n 'innerHTML|outerHTML|insertAdjacentHTML|document\.write|srcdoc|createContextualFragment' plex-browse.js; then echo "lint: HTML sink in plex-browse.js"; bad=1; fi
# desktop.js: every innerHTML must be a string/template literal whose only interpolations are ${ic.*}
while IFS= read -r l; do
  rest="${l#*innerHTML=}"
  case "$rest" in \'*|\`*) ;; *) echo "lint: non-literal innerHTML: $l"; bad=1; continue;; esac
  if echo "$rest" | rg -q '\$\{(?!ic\.)' --pcre2; then echo "lint: interpolated innerHTML: $l"; bad=1; fi
done < <(rg -n -o 'innerHTML=.{0,400}' desktop.js || true)
# Sentinel M2 condition: no Plex data may reach the app.js renderers (whose innerHTML
# sinks stay until M6). The shim must not touch app.js data globals or render/route
# entry points, and must not reach them via window/globalThis/eval.
APP='ITEMS|CAST|FACETS|NAVSEL|SMART|CMDS|PLS|LTABS|TVT|MODES|AIP|renderLib|renderPanels|renderTV|renderMusic|renderDetails|renderAskCtx|npRender|npPlay|palRender|palAnswer|ansCard|facetPage|morphFrom|playFromDetails|loadPlayer|setMode|libAlt|azRail'
if rg -n -w "$APP" plex-browse.js desktop.js; then echo "lint: shim references an app.js renderer/global"; bad=1; fi
if rg -n '\b(window|globalThis|self|top|parent)\s*(\.|\[)\s*'"'"'?(ITEMS|render|route|CAST|FACETS)|\beval\s*\(|new\s+Function\b' plex-browse.js desktop.js; then echo "lint: indirect app.js/global access"; bad=1; fi
# plex-browse.js's own render/route must stay module-local (declared in the file).
for f in render route; do rg -q "function $f\(" plex-browse.js || { if rg -n -w "$f" plex-browse.js; then echo "lint: $f is not local to plex-browse.js"; bad=1; fi; }; done
[ $bad = 0 ] && echo "lint-shim: ok"
exit $bad
