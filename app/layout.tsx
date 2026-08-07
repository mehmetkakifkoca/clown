import type { Viewport, Metadata } from "next";
import { BottomTabBar } from "@/components/Navigation/BottomTabBar";
import { Sidebar } from "@/components/Navigation/Sidebar";
import { ServiceWorkerRegistry } from "@/components/ServiceWorkerRegistry";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#b61722",
};

export const metadata: Metadata = {
  title: "Clown — Kişisel Verimlilik Merkezi",
  description: "E-posta, Takvim, Notlar ve Instagram Takibi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Clown" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="icon" href="/logo-icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo-apple.png" type="image/png" />
      </head>
      <body className="bg-background text-on-surface antialiased min-h-screen selection:bg-primary-fixed selection:text-on-primary-fixed">
        <ServiceWorkerRegistry />
        <div className="min-h-screen flex flex-col md:flex-row w-full bg-background relative">
          <Sidebar />
          <main className="flex-1 w-full min-w-0 pb-20 md:pb-8 md:pl-72">{children}</main>
          <BottomTabBar />
        </div>
      </body>
    </html>
  );
}
