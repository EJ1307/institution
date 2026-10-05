import type { Metadata, Viewport } from "next";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/source-serif-4";
import "@fontsource/tiro-devanagari-hindi/devanagari-400.css";
import "./globals.css";
import { brandBootScript, DEFAULT_BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: {
    default: `${DEFAULT_BRAND.school} · Portal`,
    template: `%s · ${DEFAULT_BRAND.short} Portal`,
  },
  description:
    "School operating system: attendance, fees, exams, admissions, transport and parent communication in one place.",
  applicationName: `${DEFAULT_BRAND.product}`,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#123d2f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: brandBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
