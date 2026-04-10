import type { Metadata } from "next";
import { Inter, Kurale } from "next/font/google";

import { I18nProvider } from "@/components/i18n-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { getRequestI18n } from "@/lib/i18n-server";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const kurale = Kurale({
  variable: "--font-kurale",
  weight: "400",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestI18n();

  return {
    title: t("app.name"),
    description: t("app.description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, messages } = await getRequestI18n();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${kurale.variable} ${inter.variable}`}>
        <ThemeProvider>
          <I18nProvider locale={locale} messages={messages}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
