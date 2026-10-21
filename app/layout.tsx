import type { Metadata, Viewport } from "next";
import "./design-tokens.css";
import "./globals.css";
import "./ui-foundations.css";

export const metadata: Metadata = {
  title: "ForgeFit | Fuel your progress",
  description: "Your simple fitness, food, and progress tracker.",
  applicationName: "ForgeFit",
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ForgeFit" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B151B",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
