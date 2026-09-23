import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "@/components/theme-provider";
import { PushProvider } from "@/components/push-provider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Stock Alert PWA",
    template: "%s · Stock Alert PWA",
  },
  description: "ติดตามราคาหุ้นและ ETF สหรัฐฯ พร้อมแจ้งเตือนเมื่อราคาถึงเงื่อนไขที่คุณกำหนด — ไม่ใช่คำแนะนำการลงทุน",
  applicationName: "Stock Alert PWA",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Stock Alert",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1117" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <PushProvider />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
