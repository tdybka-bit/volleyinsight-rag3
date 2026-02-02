import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";
import { AdminAuthProvider } from "../components/AdminAuthProvider";
import { LanguageProvider } from "../components/LanguageContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VolleyInsight - AI-Powered Volleyball Training",
  description: "Profesjonalna platforma szkoleniowa do siatkówki z zaawansowanym asystentem AI",
  // UTF-8 metadata - NOWE!
  charset: 'utf-8',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        {/* UTF-8 Encoding - CRITICAL for emoji and special chars */}
        <meta charSet="UTF-8" />
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <AdminAuthProvider>
            <LanguageProvider>
              {children}
            </LanguageProvider>
          </AdminAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}