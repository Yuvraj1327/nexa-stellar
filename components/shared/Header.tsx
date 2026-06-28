"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/wallet/WalletButton";
import { CONTRACT_CONFIG } from "@/lib/contract-config";
import { explorerContractUrl } from "@/lib/stellar-utils";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/send", label: "Send XLM" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/activity", label: "Activity" },
  { href: "/tx", label: "Transactions" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-black/60 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-stellar-blue to-stellar-purple flex items-center justify-center">
            <span className="text-sm font-bold text-white">N</span>
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-white text-base leading-none">nexa</span>
            <span className="font-light text-white/40 text-base leading-none">.stellar</span>
          </div>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                pathname === link.href
                  ? "text-white bg-white/10"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-3">
          <a
            href={explorerContractUrl(CONTRACT_CONFIG.contractId)}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {CONTRACT_CONFIG.network}
          </a>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
