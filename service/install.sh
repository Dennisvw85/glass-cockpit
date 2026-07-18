#!/bin/sh
# Install (or reinstall) the Cockpit LaunchAgent on macOS. Generates the plist
# with absolute paths for THIS checkout, then loads it. Run after `pnpm build`.
#
#   sh service/install.sh
#
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.cockpit.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/sh</string>
        <string>$DIR/service/run.sh</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>$DIR/service/cockpit.log</string>
    <key>StandardErrorPath</key>
    <string>$DIR/service/cockpit.err</string>
</dict>
</plist>
EOF

# Reload if already installed. bootout is async, so wait for it to fully
# unregister before bootstrapping — otherwise bootstrap can fail with an I/O error.
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  i=0
  while launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1 && [ "$i" -lt 20 ]; do
    sleep 0.25
    i=$((i + 1))
  done
fi
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "Installed $LABEL — starts at login, restarts on crash."
echo "  status:    launchctl print gui/$(id -u)/$LABEL | grep -E 'state|pid'"
echo "  restart:   launchctl kickstart -k gui/$(id -u)/$LABEL"
echo "  uninstall: launchctl bootout gui/$(id -u)/$LABEL && rm '$PLIST'"
