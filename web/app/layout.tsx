import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import { Shell } from "@/components/Shell";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto" });
const robotoMono = Roboto_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-roboto-mono" });

export const metadata: Metadata = {
  title: "Field-to-Fix",
  description: "Warranty claims to root cause to 8D in days, with Gemini agents on Google Cloud.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${roboto.variable} ${robotoMono.variable}`}>
      <body>
        <SessionProvider>
          <Shell>{children}</Shell>
        </SessionProvider>
      </body>
    </html>
  );
}
