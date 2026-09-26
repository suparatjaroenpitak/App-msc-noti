# Stock Alert Mobile (Android)

แอปมือถือ Android สำหรับ Stock Alert (React Native 0.86 + Expo SDK 57, TypeScript)

> **ไม่มีระบบยืนยันตัวตน (auth removed)** — เปิดแอปแล้วใช้งานได้ทันที ไม่ต้อง login/สมัครสมาชิก
> ข้อมูลทั้งหมดผูกกับ "ผู้ใช้เดียว" ของเซิร์ฟเวอร์ที่เชื่อมต่อ (สร้างให้อัตโนมัติ)
> เปลี่ยนเซิร์ฟเวอร์ได้ที่หน้า ตั้งค่า → เซิร์ฟเวอร์ (API URL)

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
- **Sounds** — ดู/อัปโหลดไฟล์เสียง/เปลี่ยนชื่อ/ตั้งเสียงดีฟอลต์/ทดลองเล่น/ลบ
- **History** — ประวัติ Alert ที่ trigger + log การแจ้งเตือนที่ส่ง
- **Analysis** — ตั้งค่าการวิเคราะห์, สั่งวิเคราะห์ราคาแนะนำ, ดูประวัติการวิเคราะห์
- **เซิร์ฟเวอร์ (แทน Profile เดิม)** — เปลี่ยน server URL, ดูข้อมูลผู้ใช้เดฟอลต์ (อ่านอย่างเดียว), ปรับความดังเสียงย้ายไปที่ Settings
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
- [ ] ตั้ง server URL โปรดักชันใน `src/config.ts` (ตอนนี้ดีฟอลต์ `http://10.0.2.2:3000` สำหรับ emulator)
