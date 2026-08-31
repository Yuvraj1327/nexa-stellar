"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/wallet/WalletButton";
import { CONTRACT_CONFIG } from "@/lib/contract-config";
import { explorerContractUrl } from "@/lib/stellar-utils";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/milestones", label: "Milestones" },
  { href: "/send", label: "Send XLM" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/analytics", label: "Analytics" },
  { href: "/activity", label: "Activity" },
  { href: "/feedback", label: "Feedback" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-black/60 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
       <img
  src="https://i.ibb.co/Xk4HzN9D/Chat-GPT-Image-Aug-31-2026-07-10-17-PM.png"
  alt="Nexa Stellar"
  className="w-15 h-14 rounded-xl object-cover"
/>
          <div className="hidden sm:block">
            <span className="font-bold text-white text-base leading-none">nexa</span>
            <span className="font-light text-white/40 text-base leading-none">.stellar</span>
          </div>
        </Link>
        <nav className="hidden lg:flex items-center gap-0.5">
          {NAV.map(l => (
            <Link key={l.href} href={l.href}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${pathname === l.href ? "text-white bg-white/10" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a href={explorerContractUrl(CONTRACT_CONFIG.contractId)} target="_blank" rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />{CONTRACT_CONFIG.network}
          </a>
          <WalletButton />
          <button onClick={() => setOpen(v => !v)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5">
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden border-t border-white/5 bg-black/80 backdrop-blur-xl px-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            {NAV.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                className={`px-3 py-2 rounded-xl text-xs text-center transition-colors ${pathname === l.href ? "text-white bg-white/10" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
