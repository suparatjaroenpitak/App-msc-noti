#!/usr/bin/env bash
# Build .apk + .ipa ผ่าน EAS cloud แล้ววางไฟล์ลง public/downloads/ สำหรับ landing page
#
# ใช้ครั้งแรก: ต้องมี token จาก https://expo.dev/accounts/<account>/settings/access-tokens
#   export EXPO_TOKEN=xxxxxxxx
#   bash scripts/build-mobile.sh
#
# หมายเหตุ:
# - .apk ใช้ profile "production" (buildType apk) — ติดตั้งเครื่องจริงได้ทันที
# - .ipa ใช้ profile "ios-simulator" (ฟรี ไม่ต้องมีบัญชี Apple Developer)
#   - ติดตั้งบน iOS Simulator เท่านั้น · ถ้าจะแจกจ่ายจริงต้องมี Apple Developer ($99/ปี)
#     แล้วเปลี่ยนเป็น: eas build --platform ios --profile production
# - Build แต่ละไฟล์ใช้เวลา ~10-25 นาที (คิวของ Expo)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/mobile"
OUT="$ROOT/public/downloads"
APK_OUT="$OUT/StockAlert-release.apk"
IPA_OUT="$OUT/StockAlert-release.ipa"

command -v curl >/dev/null || { echo "ต้องมี curl"; exit 1; }
[ -n "${EXPO_TOKEN:-}" ] || { echo "ยังไม่ได้ตั้ง EXPO_TOKEN — ดูหัวข้อหัวไฟล์สคริปต์"; exit 1; }

PLATFORMS="${1:-all}" # all | android | ios
mkdir -p "$OUT"

# 1) ติดตั้ง deps ถ้ายังไม่มี (node_modules ที่ root ของ mobile)
cd "$MOBILE"
[ -d node_modules ] || npm install --no-audit --no-fund

# 2) helper: รอ build จนเสร็จแล้วคืน URL ของ artifact
wait_for_build() { # $1 = build id
  local id="$1"
  while true; do
    local status url
    status=$(curl -s -H "Authorization: Bearer $EXPO_TOKEN" \
      "https://api.expo.dev/v2/builds/$id" | sed -n 's/.*"status":"\([a-zA-Z]*\)".*/\1/p' | head -1)
    case "$status" in
      FINISHED|finished)
        url=$(curl -s -H "Authorization: Bearer $EXPO_TOKEN" \
          "https://api.expo.dev/v2/builds/$id" | sed -n 's/.*"artifacts":{[^}]*"url":"\([^"]*\)".*/\1/p' | head -1)
        [ -n "$url" ] && { echo "$url"; return 0; }
        echo "build $id เสร็จแต่หา URL artifact ไม่เจอ" >&2; return 1 ;;
      ERRORED|CANCELED|errored|canceled)
        echo "build $id ล้มเหลว ($status) — ดู log: https://expo.dev" >&2; return 1 ;;
      *)
        echo "  ...กำลัง build ($status) — เช็คอีกครั้งใน 60 วิ"; sleep 60 ;;
    esac
  done
}

download_to() { # $1 = url, $2 = dest
  echo "ดาวน์โหลด $1 → $2"
  curl -L --fail --retry 3 -o "$2" "$1"
  ls -lh "$2"
}

# 3) Android (.apk)
if [ "$PLATFORMS" = "all" ] || [ "$PLATFORMS" = "android" ]; then
  echo "== Android: submit EAS build (profile: production, apk) =="
  ANDROID_JSON=$(EXPO_TOKEN="$EXPO_TOKEN" npx --yes eas-cli@latest build \
    --platform android --profile production --non-interactive --json --no-wait)
  ANDROID_ID=$(echo "$ANDROID_JSON" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
  echo "build id: $ANDROID_ID"
  APK_URL=$(wait_for_build "$ANDROID_ID")
  download_to "$APK_URL" "$APK_OUT"
fi

# 4) iOS (.ipa — simulator build)
if [ "$PLATFORMS" = "all" ] || [ "$PLATFORMS" = "ios" ]; then
  echo "== iOS: submit EAS build (profile: ios-simulator) =="
  IOS_JSON=$(EXPO_TOKEN="$EXPO_TOKEN" npx --yes eas-cli@latest build \
    --platform ios --profile ios-simulator --non-interactive --json --no-wait)
  IOS_ID=$(echo "$IOS_JSON" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
  echo "build id: $IOS_ID"
  IPA_TGZ_URL=$(wait_for_build "$IOS_ID")
  TMP_TGZ="$(mktemp -d)/ios-build.tar.gz"
  download_to "$IPA_TGZ_URL" "$TMP_TGZ"

  # tar.gz ข้างในมี StockAlert.app → แพ็กเป็น .ipa (Payload/StockAlert.app)
  TMP_APP="$(mktemp -d)"
  tar -xzf "$TMP_TGZ" -C "$TMP_APP"
  APP_DIR=$(find "$TMP_APP" -maxdepth 3 -name "*.app" -type d | head -1)
  [ -n "$APP_DIR" ] || { echo "หา .app ใน artifact ไม่เจอ"; exit 1; }
  mkdir -p "$TMP_APP/Payload"
  cp -R "$APP_DIR" "$TMP_APP/Payload/"
  rm -f "$IPA_OUT"
  (cd "$TMP_APP" && zip -qry "$IPA_OUT" Payload)
  rm -rf "$TMP_APP" "$TMP_TGZ"
  ls -lh "$IPA_OUT"
fi

echo ""
echo "✅ เสร็จ — ไฟล์อยู่ที่:"
[ -f "$APK_OUT" ] && echo "  APK: $APK_OUT"
[ -f "$IPA_OUT" ] && echo "  IPA: $IPA_OUT"
echo "Landing page (หน้าแรกของเว็บ) จะเปิดปุ่มดาวน์โหลดให้อัตโนมัติ (APK เสมอ, IPA เมื่อไฟล์มีอยู่)"
