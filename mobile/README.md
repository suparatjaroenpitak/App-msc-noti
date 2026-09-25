# Stock Alert Mobile (Android)

แอปมือถือ Android สำหรับ Stock Alert (React Native 0.86 + Expo SDK 57, TypeScript)

## APK ที่ build แล้ว

**`apk/StockAlert-release.apk`** (32MB, arm64-v8a, เซ็นด้วย debug key — ติดตั้งได้ทันที)

ติดตั้ง: คัดลอกไฟล์ไปเครื่อง Android แล้วเปิดไฟล์ (ต้องเปิดอนุญาต "ติดตั้งจากแหล่งที่ไม่รู้จัก")

> หมายเหตุ: เป็น release build ที่เซ็นด้วย debug key — เหมาะกับการใช้งาน/ทดสอบส่วนตัว
> ถ้าจะเผยแพร่จริง (Play Store / แจกจ่ายสาธารณะ) ต้องสร้าง keystore ของตัวเองแล้วเซ็นด้วย key นั้น

## สิ่งที่แอปทำได้

- Login ด้วยบัญชีเว็บ (demo@example.com / demo1234 บน instance ที่ seed แล้ว)
- Dashboard: ดูราคาล่าสุด + สถานะ alert แบบเรียลไทม์
- Watchlist: เพิ่ม/ลบ/ค้นหาหุ้น
- Alerts: สร้าง/แก้ไข/ลบการแจ้งเตือน (ทุก type และ condition เหมือนเว็บ)
- Sounds: ดู/ทดลองเล่นเสียงแจ้งเตือนที่อัปโหลด
- Settings: เปลี่ยน server URL, ออกจากระบบ

ปลายทาง API ดีฟอลต์ชี้ไปที่เซิร์ฟเวอร์ที่ตั้งไว้ใน `src/config.ts` (เปลี่ยนได้ในหน้า Settings ของแอป)

## Build APK ด้วยตัวเอง (เครื่องนี้)

เนื่องจากชื่อโฟลเดอร์โปรเจกต์เป็นภาษาไทย (`แอพใช้งาน/แจ้งเตือนหุ้น`) ซึ่งทำให้ NDK/Gradle build ล้มเหลว
สคริปต์ build จะคัดลอกโค้ดไป build ที่ `C:\acbuild\mobile` (path ภาษาอังกฤษ) แล้วดึง APK กลับมา

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
for f in App.tsx index.ts package.json app.json tsconfig.json eas.json babel.config.js; do
  cp "$SRC/$f" "$DST/$f" 2>/dev/null
done
rm -rf "$DST/src"
cp -r "$SRC/src" "$DST/src"

# 2) ติดตั้ง deps ถ้า package.json เปลี่ยน
cd "$DST" && [ package.json -nt node_modules ] && npm install

# 3) Build (จำบังคับ locale EN — เครื่องตั้งปฏิทินพุทธศักราชทำ AGP พัง)
export JAVA_HOME=/c/Users/ssss/AppData/Local/jdk17/jdk-17.0.20.1+1
cd "$DST/android"
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain --max-workers=2

# 4) ดึง APK กลับ
cp app/build/outputs/apk/release/app-release.apk "$SRC/apk/StockAlert-release.apk"
```

> อย่าลืม: ถ้า `package.json` เปลี่ยน ให้ `npm install` ที่ `$DST` ก่อน build เสมอ
> ถ้าโหลด dependency ใหม่ติดขัด ให้เพิ่ม artifact ไว้ใน `C:\acbuild\local-maven` (โครงสร้าง `group/path/version/file`) แล้ว Gradle จะหาจากนั้นก่อนอัตโนมัติ

### ปัญหาที่เคยเจอและวิธีแก้ (บันทึกไว้)

1. **Path ไทย** → build ต้องอยู่ที่ `C:\acbuild\mobile` เท่านั้น
2. **ปฏิทินพุทธศักราช (ปี 2569)** → AGP เขียน zip date ไม่ได้ (`VerifyException` ใน `packDate`)
   แก้แล้วด้วย `-Duser.language=en -Duser.country=US` ใน `gradle.properties`
3. **Hermes AAR โหลดไม่ได้** → เครื่องนี้เน็ตไป Maven Central ช้ามาก จึงดาวน์โหลดเองด้วย curl แล้ววางใน local maven
4. **RAM ต่ำ** → ปิด LDPlayer/Chrome ก่อน build ถ้า RAM ว่างน้อยกว่า ~4GB ไม่งั้น Gradle จะหยุดรอ RAM แล้วดูเหมือนค้าง

### TODO ก่อนเผยแพร่จริง

- [ ] สร้าง release keystore (`keytool -genkeypair -v -keystore stock-alert.keystore -alias stockalert -keyalg RSA -keysize 2048 -validity 10000`)
- [ ] ตั้ง `MY_APP_UPLOAD_STORE_FILE` ฯลฯ ใน `gradle.properties` แล้วเซ็น release build ด้วย key จริง
- [ ] Build `armeabi-v7a` ด้วยถ้าต้องรองรับเครื่องรุ่นเก่า (ตอนนี้ arm64 เท่านั้น)
- [ ] ตั้ง server URL โปรดักชันใน `src/config.ts`
