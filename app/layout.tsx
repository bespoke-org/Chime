import type { Metadata } from "next";
import { Kurale, Manrope } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const kurale = Kurale({
  variable: "--font-kurale",
  weight: "400",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lively Forms",
  description: "Lively Forms is a conversational form builder for creating, publishing, and reviewing forms.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${kurale.variable} ${manrope.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
