import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Stock Alert API",
    template: "%s · Stock Alert API",
  },
  description: "API สำหรับแอป Stock Alert มือถือ — ติดตามราคาหุ้น/ETF พร้อมแจ้งเตือนเมื่อราคาถึงเงื่อนไขที่กำหนด",
};

export const viewport: Viewport = {
  themeColor: "#0f1117",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
