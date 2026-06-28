import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/shared/Header";
import { Toaster } from "@/components/shared/Toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nexa Stellar — Decentralized Crowdfunding",
  description:
    "Launch and fund projects on the Stellar blockchain with transparent, trustless crowdfunding powered by Soroban smart contracts.",
  keywords: ["Stellar", "Soroban", "crowdfunding", "blockchain", "DeFi"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#080a0f] text-white antialiased`}>
        <Providers>
          <div className="relative min-h-screen">
            {/* Background gradient */}
            <div className="fixed inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-br from-stellar-blue/5 via-transparent to-stellar-purple/5" />
              <div className="absolute top-0 left-1/3 w-96 h-96 bg-stellar-blue/5 rounded-full blur-3xl" />
              <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-stellar-purple/5 rounded-full blur-3xl" />
            </div>

            <Header />
            <main className="relative">{children}</main>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
