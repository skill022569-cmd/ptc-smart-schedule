import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "ระบบจัดตารางเรียน-ตารางสอน | วิทยาลัยการอาชีพโพนทอง", description: "ระบบจัดตารางเรียน-ตารางสอนอัตโนมัติ วิทยาลัยการอาชีพโพนทอง" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
