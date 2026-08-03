"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/push";
import { BottomTabBar } from "@/components/Navigation/BottomTabBar";
import { Sidebar } from "@/components/Navigation/Sidebar";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <html lang="tr">
      <head>
        <title>Clown — Kişisel Verimlilik Merkezi</title>
        <meta name="description" content="E-posta, Takvim, Notlar ve Instagram Takibi" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Clown" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="icon" href="/logo-icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo-apple.png" type="image/png" />
        <meta name="theme-color" content="#b61722" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="bg-background text-on-surface antialiased min-h-screen selection:bg-primary-fixed selection:text-on-primary-fixed">
        <div className="min-h-screen flex flex-col md:flex-row w-full bg-background relative">
          <Sidebar />
          <main className="flex-1 w-full min-w-0 pb-20 md:pb-8 md:pl-72">{children}</main>
          <BottomTabBar />
        </div>
      </body>
    </html>
  );
}
