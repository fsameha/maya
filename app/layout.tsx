import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Montserrat } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { colorModeScript, introScript } from "@/lib/bootScripts";
import { InkSignature } from "@/components/loader/InkSignature";
import { CursorRing } from "@/components/site/CursorRing";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const montserrat = Montserrat({ subsets: ["latin"], display: "swap", variable: "--font-montserrat", weight: ["500", "600"] });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-jetbrains" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Maya · Watching over, without watching",
  description: "An AI care companion for older adults living with memory loss, and the families who look after them.",
  openGraph: { images: ["/og.png"] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1317" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: colorModeScript + ";" + introScript }} />
        <Providers>
          <a href="#main" className="visually-hidden">Skip to content</a>
          <Nav />
          <main id="main">{children}</main>
          <Footer />
          <InkSignature />
          <CursorRing />
        </Providers>
      </body>
    </html>
  );
}
