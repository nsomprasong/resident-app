import type { Metadata } from "next";
import "../styles/globals.css";
import MainLayoutClient from "@/components/layout/MainLayout";

export const metadata: Metadata = {
  title: "Resident — ระบบจัดการที่พัก",
  description: "ระบบจัดการห้องพัก การจอง และบริการภายในโรงแรม",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    shortcut: ["/logo.png"],
    apple: [{ url: "/logo.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  return (
    <html lang="th">
      <body className="bg-background text-foreground antialiased">
        <MainLayoutClient>{children}</MainLayoutClient>
      </body>
    </html>
  );
}
