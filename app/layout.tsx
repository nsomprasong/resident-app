import type { Metadata } from "next";
import "../styles/globals.css";
import MainLayoutClient from "@/components/layout/MainLayout";

export const metadata: Metadata = {
  title: "Resident — ระบบจัดการที่พัก",
  description: "ระบบจัดการห้องพัก การจอง และบริการภายในโรงแรม",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  return (
    <html lang="th">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <MainLayoutClient>{children}</MainLayoutClient>
      </body>
    </html>
  );
}
