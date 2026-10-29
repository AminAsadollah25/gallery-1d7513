#!/bin/sh
# Builds the game launcher for Windows and macOS into ../download/
# Requires Go 1.24+. Run from this folder: ./build.sh
set -e
cd "$(dirname "$0")"
OUT=../download
TMP=$(mktemp -d)
export CGO_ENABLED=0

# Windows: single .exe that opens the game in its own window
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w -H windowsgui" -o "$OUT/NeonMetroidvania.exe" .

# macOS: .app bundle for Apple Silicon and Intel Macs
APP="$TMP/Neon Metroidvania.app"
mkdir -p "$APP/Contents/MacOS"
GOOS=darwin GOARCH=arm64 go build -trimpath -ldflags "-s -w" -o "$APP/Contents/MacOS/neon-arm64" .
GOOS=darwin GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o "$APP/Contents/MacOS/neon-x86_64" .
cat > "$APP/Contents/MacOS/NeonMetroidvania" <<'SH'
#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "$(uname -m)" = "arm64" ]; then exec "$DIR/neon-arm64"; else exec "$DIR/neon-x86_64"; fi
SH
chmod +x "$APP/Contents/MacOS/"*
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Neon Metroidvania</string>
  <key>CFBundleDisplayName</key><string>Neon Metroidvania</string>
  <key>CFBundleIdentifier</key><string>com.example.neonmetroidvania</string>
  <key>CFBundleExecutable</key><string>NeonMetroidvania</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
</dict>
</plist>
PLIST
rm -f "$OUT/NeonMetroidvania-mac.zip"
(cd "$TMP" && zip -qry -X "$OLDPWD/$OUT/NeonMetroidvania-mac.zip" "Neon Metroidvania.app")
rm -rf "$TMP"
ls -la "$OUT"
