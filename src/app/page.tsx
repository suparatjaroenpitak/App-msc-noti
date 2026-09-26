export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Stock Alert API</h1>
      <p style={{ color: "#888", marginBottom: 24 }}>
        เว็บฝั่ง UI ถูกย้ายไปที่แอปมือถือ (Android/iOS) แล้ว — เซิร์ฟเวอร์นี้เหลือบริการ API เท่านั้น
      </p>
      <ul style={{ lineHeight: 2, color: "#ccc" }}>
        <li>
          <code>GET /api/health</code> — สถานะเซิร์ฟเวอร์/ฐานข้อมูล
        </li>
        <li>
          <code>GET /api/system/status</code> — สถานะระบบ (DB, push, แหล่งราคา)
        </li>
        <li>REST API (alerts, watchlist, assets, sounds, analysis, history) — เรียกได้เลย ไม่ต้องยืนยันตัวตน (ผูกกับผู้ใช้เดียวของอินสแตนซ์)</li>
      </ul>
    </main>
  );
}
