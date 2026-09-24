# Stock Alert — Android App (React Native / Expo)

แอปมือถือ Android ที่คุยกับ API ชุดเดียวกับเว็บ PWA (Next.js บน Render)
เขียนด้วย **Expo SDK 57 / React Native 0.86 / TypeScript strict**

## ฟีเจอร์ (v1)

| หน้า | รายละเอียด |
| --- | --- |
| Login | กรอก server URL (Render) + อีเมล/รหัสผ่าน → เก็บ token ไว้ในเครื่อง |
| ภาพรวม (Dashboard) | จำนวน watchlist / active alerts, สถานะตลาดสหรัฐฯ, ราคาล่าสุด, เหตุการณ์แจ้งเตือนล่าสุด, สถานะระบบ |
| Watchlist | ค้นหา symbol, เพิ่ม, ลบ, จัดลำดับขึ้น/ลง |
| Alerts | เปิด/ปิด Alert, ทดสอบส่ง notification (แจ้งผล sent/failed/สาเหตุ), ลบ |
| Alert Form | สร้าง/แก้ไข Alert (type, เงื่อนไข, ราคาเป้าหมาย, cooldown, one-time, ข้อความ, เสียง) |
| เสียงแจ้งเตือน | ดูรายการเสียง, เล่นตัวอย่าง, ตั้งเป็นค่าเริ่มต้น, ลบ |
| ตั้งค่า | เปลี่ยน server URL, preference การแจ้งเตือน, สถานะระบบ, ออกจากระบบ |

### ยังไม่รวมในเวอร์ชันนี้
- **Push notification แบบ native (FCM)** — ต้องตั้งค่า Firebase project + ส่งจากเซิร์ฟเวอร์ผ่าน FCM (เว็บยังใช้ Web Push/VAPID ตามเดิม)
- อัปโหลดเสียงใหม่จากมือถือ (ทำได้จากเว็บ PWA แล้วเสียงจะ sync มาในแอป)
- แก้ไขโปรไฟล์/เปลี่ยนรหัสผ่าน, AI suggest price, Analysis settings

## การยืนยันตัวตน

เว็บใช้ session cookie (HttpOnly) ซึ่งแอป native ใช้ไม่สะดวก จึงเพิ่ม endpoint สำหรับออก token:

```
POST /api/auth/token      { email, password }      → { token, expiresAt, user }
DELETE /api/auth/token    Authorization: Bearer …  → revoke
```

ทุก endpoint เดิมของเว็บรองรับ `Authorization: Bearer <token>` แล้ว (ดู `src/lib/auth/session.ts`)
โดย token เก็บใน `Session` ตารางเดียวกับ cookie login จึงหมดอายุ 30 วันเท่ากัน

## รันในเครื่อง (สำหรับพัฒนา)

```bash
cd mobile
npm install

# ตั้ง URL เซิร์ฟเวอร์เริ่มต้นที่ src/config.ts (ค่าเริ่มต้นชี้ http://10.0.2.2:3000 = localhost บน Android Emulator)
npx expo start          # กด a เพื่อเปิด Android Emulator หรือสแกน QR ด้วย Expo Go
```

> ทดสอบกับมือถือจริงให้ตั้ง server URL เป็น `https://<ชื่อแอป>.onrender.com` ในหน้า Login/Settings
> (หรือแก้ `DEFAULT_SERVER_URL` ใน `src/config.ts` ก่อน build)

## Build APK ด้วย EAS Build (คลาวด์ — ไม่ต้องติดตั้ง Android SDK)

ครั้งแรกต้องมีบัญชี Expo ฟรี (สมัครที่ https://expo.dev/signup) แล้ว:

```bash
cd mobile
npx eas-cli login                 # ล็อกอินด้วยบัญชี Expo
npx eas-cli init                  # ผูกโปรเจกต์นี้กับบัญชี (สร้าง project id ให้)
npx eas-cli build --platform android --profile preview
```

- profile `preview` ตั้งค่า `android.buildType: "apk"` แล้ว → ได้ไฟล์ **.apk** ให้ติดตั้งลงเครื่องโดยตรง
  (profile `production` จะออกเป็น `.aab` สำหรับอัปโหลด Play Store)
- Build ใช้เวลาประมาณ 10–20 นาทีบนคลาวด์ ฟรี 30 builds/เดือน (คิวแบบช้า)
- เมื่อเสร็จ EAS จะให้ URL ให้กดดาวน์โหลด APK (หรือสแกน QR เพื่อติดตั้งลงมือถือ)
- ติดตั้งบนมือถือต้องอนุญาต "ติดตั้งจากแหล่งที่ไม่รู้จัก" (Unknown sources)

## Build APK ในเครื่อง (ไม่ใช้บัญชี Expo)

ต้องมี: **JDK 17**, **Android SDK** (platform 36, build-tools 36.0.0, platform-tools, cmake;3.22.1),
**NDK 27.1.12297006** (~745 MB) — ติดตั้งผ่าน `sdkmanager` ได้

> ⚠️ **สำคัญ: path ของโปรเจกต์ต้องเป็น ASCII เท่านั้น** — Gradle/CMake/NDK จะพัง (Unable to
> access jarfile / mojibake) ถ้า path มีอักษรไทยหรืออักขระพิเศษ ให้คัดลอกโฟลเดอร์ `mobile/`
> ไปไว้ที่ path อังกฤษก่อน build เช่น `C:\acbuild\mobile`

```bash
# 1) เตรียม env
export JAVA_HOME="<path jdk17>"
export ANDROID_HOME="<path Android/Sdk>"

# 2) generate native project + build APK (arm64 รองรับมือถือทุกรุ่นใหม่)
cd <ascii-path>/mobile
npx expo prebuild --platform android
# ตรวจว่า android/local.properties มี sdk.dir ชี้ไปที่ Android SDK
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a

# APK อยู่ที่: android/app/build/outputs/apk/release/app-release.apk
```

หมายเหตุ
- APK ที่ได้เซ็นด้วย debug keystore (Expo template ตั้งค่า release ให้ใช้ debug signing) → ติดตั้งได้เลย
  แต่ไม่ควรใช้ขึ้น Play Store; ถ้าจะเผยแพร่จริงให้สร้าง keystore และตั้ง `signingConfigs.release`
- อยากรองรับทั้ง 32/64-bit ให้ตัด `-PreactNativeArchitectures=arm64-v8a` ออก (build นานขึ้นมาก)
- ครั้งแรกใช้เวลานาน (Gradle + Maven dependencies หลายร้อย MB)

## โครงสร้าง

```
mobile/
├── App.tsx                     # root: SafeAreaProvider + AuthProvider + Navigator
├── app.json                    # ชื่อแอป/package com.stockalert.mobile/dark theme
├── eas.json                    # profile preview = APK
└── src/
    ├── api/client.ts           # fetch + Bearer token + server URL (AsyncStorage)
    ├── api/types.ts            # type ที่ตรงกับ response ของ API ฝั่งเว็บ
    ├── auth.tsx                # AuthProvider (token/user/login/logout)
    ├── config.ts               # DEFAULT_SERVER_URL, APP_VERSION
    ├── hooks/useApi.ts         # GET + loading/error/reload
    ├── components/ui.tsx       # Screen/Card/Button/Input/Badge ฯลฯ
    ├── navigation/             # tabs + stack
    └── screens/                # Login, Dashboard, Watchlist, Alerts, AlertForm, Sounds, Settings
```

## ข้อจำกัดที่ควรรู้

- เสียง custom เล่นได้เมื่อแอป/เว็บ**เปิดอยู่**เท่านั้น — ตอนเบื้องหลัง OS ใช้เสียงระบบแจ้งเตือน
- Token เก็บใน AsyncStorage (ไม่ใช่ SecureStore) — เหมาะระดับใช้งานทั่วไป ถ้าต้องการแข็งขึ้นเปลี่ยนเป็น `expo-secure-store` ได้
- แอปไม่มี background worker — ข้อมูล refresh เมื่อเปิดแอป/กด pull-to-refresh
