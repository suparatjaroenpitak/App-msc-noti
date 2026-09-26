# Stock Alert Mobile (Android / iOS)

แอปมือถือ Stock Alert (React Native 0.86 + Expo SDK 57, TypeScript)

> **🆕 v1.2.0: ทำงานในเครื่อง 100% (offline-first)** — ย้ายบริการทั้งหมดจากเซิร์ฟเวอร์ (Render) มาไว้ในแอป
> ฐานข้อมูล SQLite ในเครื่อง + เครื่องยนต์เตือน (ตรวจทุก 30 วินาที) + วิเคราะห์ราคา + คลังเสียง
> **ไม่มีการเรียก API ภายนอกเลย** — เปิดใช้ได้แม้ไม่มีอินเทอร์เน็ต
> ข้อมูลราคาเป็น **การจำลอง (simulated)** ในเครื่อง ไม่ใช่ราคาตลาดจริง

## APK ที่ build แล้ว

**`apk/StockAlert-release.apk`** (81MB, รองรับ 4 ABI: arm64-v8a / armeabi-v7a / x86 / x86_64, เซ็นด้วย debug key — ติดตั้งได้ทันที)

ติดตั้ง: คัดลอกไฟล์ไปเครื่อง Android แล้วเปิดไฟล์ (ต้องเปิดอนุญาต "ติดตั้งจากแหล่งที่ไม่รู้จัก")
รองรับทั้งเครื่องจริงทุกรุ่นและ emulator (รวม LDPlayer — ใช้ ABI x86/x86_64)

> หมายเหตุ: เป็น release build ที่เซ็นด้วย debug key — เหมาะกับการใช้งาน/ทดสอบส่วนตัว
> ถ้าจะเผยแพร่จริง (Play Store / แจกจ่ายสาธารณะ) ต้องสร้าง keystore ของตัวเองแล้วเซ็นด้วย key นั้น

## สิ่งที่แอปทำได้ (ครบทุกฟังก์ชันของเว็บ)

- **Dashboard** — ดูราคาล่าสุด + สถานะ alert แบบเรียลไทม์ (เปิดแอปมาเจอเลย ไม่มีหน้า login)
- **Watchlist** — เพิ่ม/ลบ/ค้นหาหุ้น/ETF
- **Alerts** — สร้าง/แก้ไข/ลบ/พักการแจ้งเตือน (ทุก type และ condition เหมือนเว็บ)
- **Sounds (local-only)** — เลือก/นำเข้าไฟล์เสียงจากเครื่อง, เปลี่ยนชื่อ, ตั้งเสียงดีฟอลต์, ทดลองเล่น, ลบ — **ทั้งหมดเก็บในเครื่อง ไม่ส่งขึ้นเซิร์ฟเวอร์** (มีเสียงในตัว 4 เสียง: Ding/Chime/Alert/Bell)
- **เสียงเตือนตอน trigger** — เมื่อ Alert ที่ watch อยู่ trigger และแอปเปิดอยู่ แอปจะเล่นเสียงที่เลือกไว้ในเครื่องทันที (ไม่ผ่านเซิร์ฟเวอร์)
- **History** — ประวัติ Alert ที่ trigger + log การแจ้งเตือนที่ส่ง
- **ต่อ Alert** — แต่ละ Alert เลือกเสียงของตัวเองได้จากคลังเสียงในเครื่อง (เมื่อราคา trigger และแอปเปิดอยู่ จะเล่นเสียงนั้นทันที)
- **เซิร์ฟเวอร์ (แทน Profile เดิม)** — ดู URL/ข้อมูลผู้ใช้เดฟอลต์ (อ่านอย่างเดียว — fix ถาวรแล้ว)
- **Settings** — เปลี่ยน server URL, ดูสถานะระบบ, ออกจากระบบ

ปลายทาง API ดีฟอลต์ชี้ไปที่เซิร์ฟเวอร์ที่ตั้งไว้ใน `src/config.ts` (เปลี่ยนได้ในหน้า Settings ของแอป)

> ฝั่งเว็บ (Next.js) ถูกลดเหลือ **API-only** แล้ว — หน้าเว็บ UI ทั้งหมดย้ายมาอยู่ในแอปนี้
> เข้า root URL ของเซิร์ฟเวอร์จะเจอหน้าสรุป endpoint สั้น ๆ

## Build APK ด้วยตัวเอง (เครื่องนี้)

เนื่องจากชื่อโฟลเดอร์โปรเจกต์เป็นภาษาไทย (`แอพใช้งาน/แจ้งเตือนหุ้น`) ซึ่งทำให้ NDK/Gradle build ล้มเหลว
ต้องคัดลอกโค้ดไป build ที่ `C:\acbuild\mobile` (path ภาษาอังกฤษ) แล้วดึง APK กลับมา

### เตรียมครั้งแรก (ทำแล้วเสร็จบนเครื่องนี้)

| ตัวแปร | ค่าที่ใช้ได้ |
|---|---|
| JDK 17 | `C:\Users\ssss\AppData\Local\jdk17\jdk-17.0.20.1+1` |
| Android SDK | `C:\Users\ssss\AppData\Local\Android\Sdk` (build-tools 36 + platform 36 + NDK 27.1.12297006) |
| Gradle 9.3.1 | อยู่ใน Gradle wrapper cache แล้ว |
| Local maven | `C:\acbuild\local-maven` (Hermes AAR ที่โหลดเอง — เพราะเน็ตเครื่องนี้โหลดจาก Maven Central ช้า/ติดขัด) |

### สั่ง build (ทุกครั้งที่แก้โค้ด `mobile/`)

เปิด Git Bash แล้วรัน:

```bash
ROOT="/d/แอพใช้งาน/แจ้งเตือนหุ้น/stock-alert/App msc noti"
SRC="$ROOT/mobile"; DST="/c/acbuild/mobile"

# 1) ซิงก์โค้ดล่าสุดไป build path (ไม่ทับ node_modules / build dir)
for f in App.tsx index.ts package.json app.json tsconfig.json eas.json; do
  cp "$SRC/$f" "$DST/$f" 2>/dev/null
done
rm -rf "$DST/src"
cp -r "$SRC/src" "$DST/src"
cp "$SRC/android/build.gradle" "$SRC/android/gradle.properties" "$SRC/android/settings.gradle" "$DST/android/" 2>/dev/null
cp -r "$SRC/android/app" "$DST/android/"

# 2) ติดตั้ง deps ถ้า package.json เปลี่ยน
cd "$DST" && [ package.json -nt node_modules ] && npm install

# 3) Build (gradle.properties บังคับ locale EN แล้ว — เครื่องตั้งปฏิทินพุทธศักราชทำ AGP พัง)
export JAVA_HOME=/c/Users/ssss/AppData/Local/jdk17/jdk-17.0.20.1+1
cd "$DST/android"
./gradlew assembleRelease --console=plain --max-workers=1

# 4) ดึง APK กลับ
cp app/build/outputs/apk/release/app-release.apk "$SRC/apk/StockAlert-release.apk"
```

> อย่าลืม: ถ้า `package.json` เปลี่ยน ให้ `npm install` ที่ `$DST` ก่อน build เสมอ
> ถ้าโหลด dependency ใหม่ติดขัด ให้เพิ่ม artifact ไว้ใน `C:\acbuild\local-maven` (โครงสร้าง `group/path/version/file`) แล้ว Gradle จะหาจากนั้นก่อนอัตโนมัติ
> Build เต็ม (4 ABI) ใช้เวลา ~14 นาที · อยากได้ APK เล็กลงเฉพาะเครื่องจริง ใส่ `-PreactNativeArchitectures=arm64-v8a` (ได้ ~32MB)

### ปัญหาที่เคยเจอและวิธีแก้ (บันทึกไว้)

1. **Path ไทย** → build ต้องอยู่ที่ `C:\acbuild\mobile` เท่านั้น
2. **ปฏิทินพุทธศกราช (ปี 2569)** → AGP เขียน zip date ไม่ได้ (`VerifyException` ใน `packDate`)
   แก้แล้วด้วย `-Duser.language=en -Duser.country=US` ใน `gradle.properties`
3. **Hermes AAR โหลดไม่ได้** → เครื่องนี้เน็ตไป Maven Central ช้ามาก จึงดาวน์โหลดเองด้วย curl แล้ววางใน local maven
   (อาการคือ `:app:configureCMake` ค้างเงียบ ๆ ตลอดไป — จริง ๆ คือ Gradle ห้อยรอ download)
4. **RAM ต่ำ** → ปิด LDPlayer/Chrome ก่อน build ถ้า RAM ว่างน้อยกว่า ~3GB ไม่งั้น Gradle จะหยุดรอ RAM แล้วดูเหมือนค้าง
5. **JAVA_HOME** → ใช้ `jdk-17.0.20.1+1` (มี `+1` ปิดท้าย ไม่ใช่ `.1-hotspot`)

### TODO ก่อนเผยแพร่จริง

- [ ] สร้าง release keystore (`keytool -genkeypair -v -keystore stock-alert.keystore -alias stockalert -keyalg RSA -keysize 2048 -validity 10000`)
- [ ] ตั้ง `MY_APP_UPLOAD_STORE_FILE` ฯลฯ ใน `gradle.properties` แล้วเซ็น release build ด้วย key จริง

## สถาปัตยกรรม (v1.2.0+)

```
แอป (APK/IPA)
├── src/lib/local/db.ts        ← SQLite: assets, watchlist, alerts, events, analysis, prefs
├── src/lib/local/market.ts    ← ราคาจำลอง + เวลาตลาดสหรัฐ (ET)
├── src/lib/local/analysis-engine.ts ← เอนจินวิเคราะห์ builtin-v1 (ตัวเดียวกับ server เดิม)
├── src/lib/local/backend.ts   ← "API" ทั้งหมดบนเครื่อง + alert engine (poll ทุก 30 วิ)
├── src/lib/local-sounds.ts    ← คลังเสียงในเครื่อง (built-in + import)
└── src/api/client.ts          ← route ทุก call เข้า local backend (ไม่มี network)
```

หน้าจอทุกหน้าใช้โค้ดเดิม — แค่เปลี่ยนว่า `api()` เรียก local แทน HTTP

## Build สำหรับ iOS / iPad

ต้อง build ผ่าน **EAS Build (คลาวด์ของ Expo)** เพราะ compile แอป iOS ต้องใช้ macOS/Xcode เท่านั้น (ห้ามบน Windows)
รวม iPad แล้ว (`supportsTablet: true` ใน app.json → รันบน iPad ได้เต็มจอ)

### เตรียมครั้งแรก

```bash
npm install -g eas-cli
cd mobile
eas login          # สมัครบัญชีฟรีที่ https://expo.dev ถ้ายังไม่มี
eas config:push    # ข้ามได้ถ้าไม่ใช้ push
```

### สั่ง build

```bash
eas build --platform ios --profile production     # ไฟล์ .ipa สำหรับเครื่องจริง/App Store
eas build --platform ios --profile ios-simulator  # สำหรับ iOS Simulator (ฟรี ไม่ต้องมีบัญชี Apple Developer)
eas build --platform android --profile production # Android ก็ใช้ EAS ได้เหมือนกัน
```

### ข้อจำกัดของ iOS ที่ต้องรู้

| กรณี | ต้องมีอะไร |
|---|---|
| รันบน **iOS Simulator** | ไม่ต้องมีบัญชี Apple Developer (ฟรี) |
| ติดตั้ง **เครื่อง iPhone/iPad จริง** ของตัวเอง | Apple ID ฟรี + ต่อสาย USB ผ่าน Xcode (แอปหมดอายุต้อง reinstall ทุก 7 วัน) หรือ EAS internal distribution |
| แจกจ่ายจริง / TestFlight / App Store | **Apple Developer Program $99/ปี** |

- bundle id: `com.stockalert.mobile` (แก้ได้ใน app.json → ios.bundleIdentifier)
- **iOS ได้อยู่แล้วทั้งชุด** — โค้ด local backend ทำงานบน iOS เหมือน Android (SQLite ผ่าน expo-sqlite รองรับทั้งสอง platform)
- ถ้า EAS ถามเรื่อง credentials เลือก "Let EAS manage credentials" ทั้งหมดได้เลย
- หน้าแอปเป็น dark theme ทั้งหมด — iPad รองรับทั้ง portrait/landscape (ปรับใน app.json → ios.infoPlist)
- แอปเสียงแจ้งเตือนใช้ `expo-audio` ซึ่งรองรับ iOS อยู่แล้ว ไม่ต้องตั้งค่าเพิ่ม
