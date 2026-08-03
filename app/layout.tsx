import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomTabBar } from "@/components/Navigation/BottomTabBar";
import { Sidebar } from "@/components/Navigation/Sidebar";

export const metadata: Metadata = {
  title: "Clown — Personal Productivity",
  description: "Unified hub for Email, Calendar, Notion Notes, and Instagram Account tracking",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/logo-icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/logo-apple.png", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Clown",
  },
};

export const viewport: Viewport = {
  themeColor: "#b61722",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
