#!/usr/bin/env bash
set -euo pipefail
LOG=/workspace/perf-fu9k/launch-live.log
exec >>"$LOG" 2>&1
echo "=== launch $(date -Is) ==="
export DISPLAY="${DISPLAY:-:5}"
# Prefer live bus address from box helper if present and secrets respond
CANDIDATES=()
if [ -f /tmp/xdg-runtime-box/dbus-session-address ]; then
  CANDIDATES+=("$(cat /tmp/xdg-runtime-box/dbus-session-address)")
fi
CANDIDATES+=("unix:path=/tmp/dbus-oKUTlnULcu,guid=8c4c87d5fb5793188a34cf3a6adb6af4")
if [ -f /tmp/xdg-runtime-box-5/dbus-session-address ]; then
  CANDIDATES+=("$(cat /tmp/xdg-runtime-box-5/dbus-session-address)")
fi
PICK=""
for c in "${CANDIDATES[@]}"; do
  [ -n "$c" ] || continue
  if DBUS_SESSION_BUS_ADDRESS="$c" dbus-send --session --dest=org.freedesktop.secrets --print-reply /org/freedesktop/secrets org.freedesktop.DBus.Peer.Ping >/dev/null 2>&1; then
    # Prefer a bus that can list PlexUW without printing secrets
    if DBUS_SESSION_BUS_ADDRESS="$c" secret-tool search --all service PlexUW 2>/dev/null | rg -q 'attribute.service = PlexUW'; then
      PICK="$c"
      echo "picked bus with PlexUW: $c"
      break
    fi
    PICK="${PICK:-$c}"
    echo "secrets ping ok: $c"
  else
    echo "secrets ping FAIL: $c"
  fi
done
if [ -z "$PICK" ]; then
  echo "FATAL: no Secret Service bus"
  exit 2
fi
export DBUS_SESSION_BUS_ADDRESS="$PICK"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/xdg-runtime-5}"
# Point GNOME_KEYRING_CONTROL at whatever the daemon advertises if present
if [ -d /tmp/xdg-runtime-4/keyring ]; then
  export GNOME_KEYRING_CONTROL=/tmp/xdg-runtime-4/keyring
elif [ -d /tmp/xdg-runtime/keyring ]; then
  export GNOME_KEYRING_CONTROL=/tmp/xdg-runtime/keyring
fi
echo "DISPLAY=$DISPLAY DBUS=$DBUS_SESSION_BUS_ADDRESS GKR=$GNOME_KEYRING_CONTROL"
BIN="${1:-/home/box/plexuw-artifacts/93cdcf0/PlexUW_0.1.0_amd64.AppImage}"
shift || true
chmod +x "$BIN" 2>/dev/null || true
pkill -f 'PlexUW_0.1.0_amd64.AppImage' 2>/dev/null || true
pkill -f '/tmp/.mount_PlexUW' 2>/dev/null || true
pkill -x plexuw 2>/dev/null || true
sleep 0.4
# Prefer non-AppImage ELF if caller passes AppImage — AppImage may isolate; try extract-and-run first but log
echo "exec $BIN"
# Use dbus-run-session? NO — that would create empty session without secrets.
# Ensure we don't clear env: exec with explicit env
exec env DISPLAY="$DISPLAY" DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" \
  XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" \
  GNOME_KEYRING_CONTROL="${GNOME_KEYRING_CONTROL:-}" \
  HOME="$HOME" USER="$USER" PATH="$PATH" XAUTHORITY="${XAUTHORITY:-}" \
  "$BIN" --appimage-extract-and-run "$@"
