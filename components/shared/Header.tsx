"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/wallet/WalletButton";
import { CONTRACT_CONFIG } from "@/lib/contract-config";
import { explorerContractUrl } from "@/lib/stellar-utils";
import { useState, useEffect } from "react";

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV = [
  { href: "/",           label: "Home",       icon: "⬡" },
  { href: "/campaigns",  label: "Campaigns",  icon: "🚀" },
  { href: "/milestones", label: "Milestones", icon: "🏁" },
  { href: "/send",       label: "Send XLM",   icon: "💸" },
  { href: "/dashboard",  label: "Dashboard",  icon: "👛" },
  { href: "/analytics",  label: "Analytics",  icon: "📊" },
  { href: "/activity",   label: "Activity",   icon: "📡" },
  { href: "/feedback",   label: "Feedback",   icon: "💬" },
];

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 shrink-0 group">
      {/* Custom logo image */}
      <img
        src="https://i.ibb.co/27ZvbBRQ/Chat-GPT-Image-Aug-31-2026-07-10-17-PM.png"
        alt="Nexa Stellar"
        className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-stellar-blue/20 group-hover:shadow-stellar-blue/40 transition-shadow ring-1 ring-white/10"
      />
      {/* Brand name — always visible */}
      <div className="flex items-baseline gap-1 leading-none">
        <span className="font-extrabold text-white text-xl tracking-tight">Nexa</span>
        <span className="font-medium text-stellar-blue text-xl tracking-tight">Stellar</span>
      </div>
    </Link>
  );
}

// ─── Network badge ────────────────────────────────────────────────────────────

function NetworkBadge() {
  return (
    <a
      href={explorerContractUrl(CONTRACT_CONFIG.contractId)}
      target="_blank"
      rel="noopener noreferrer"
      className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-400/10 border border-green-400/20 text-xs text-green-400 hover:bg-green-400/20 transition-colors"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      {CONTRACT_CONFIG.network}
    </a>
  );
}

// ─── Desktop nav link ─────────────────────────────────────────────────────────

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap ${
        active
          ? "text-white bg-white/10"
          : "text-white/55 hover:text-white hover:bg-white/[0.07]"
      }`}
    >
      {active && (
        <span className="absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-stellar-blue to-stellar-purple rounded-full" />
      )}
      {label}
    </Link>
  );
}

// ─── Mobile menu item ─────────────────────────────────────────────────────────

function MobileNavItem({
  href, label, icon, active, onClick,
}: {
  href: string; label: string; icon: string; active: boolean; onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${
        active
          ? "bg-gradient-to-r from-stellar-blue/20 to-stellar-purple/10 border border-stellar-blue/30 text-white"
          : "text-white/60 hover:text-white hover:bg-white/[0.06] border border-transparent"
      }`}
    >
      <span className="text-base w-5 text-center shrink-0">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
      {active && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-stellar-blue" />
      )}
    </Link>
  );
}

// ─── Hamburger icon ───────────────────────────────────────────────────────────

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <div className="flex flex-col justify-center gap-[5px] w-5 h-5">
      <span
        className={`block h-0.5 bg-current rounded-full transition-all duration-300 origin-center ${
          open ? "rotate-45 translate-y-[7px]" : ""
        }`}
      />
      <span
        className={`block h-0.5 bg-current rounded-full transition-all duration-300 ${
          open ? "opacity-0 scale-x-0" : ""
        }`}
      />
      <span
        className={`block h-0.5 bg-current rounded-full transition-all duration-300 origin-center ${
          open ? "-rotate-45 -translate-y-[7px]" : ""
        }`}
      />
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close menu on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Close menu on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-50 w-full">
        {/* Glass bar */}
        <div className="border-b border-white/[0.07] bg-[#080a0f]/80 backdrop-blur-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-5 flex items-center justify-between h-16">

            {/* Left — Logo */}
            <Logo />

            {/* Centre — Desktop nav */}
            <nav className="hidden lg:flex items-center gap-0.5 mx-4">
              {NAV.map(l => (
                <NavLink key={l.href} href={l.href} label={l.label} active={pathname === l.href} />
              ))}
            </nav>

            {/* Right — Network badge + Wallet + Hamburger */}
            <div className="flex items-center gap-2 shrink-0">
              <NetworkBadge />
              <WalletButton />

              {/* Hamburger — mobile only */}
              <button
                onClick={() => setOpen(v => !v)}
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
                className={`lg:hidden w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
                  open
                    ? "text-white bg-white/10"
                    : "text-white/60 hover:text-white hover:bg-white/[0.07]"
                }`}
              >
                <HamburgerIcon open={open} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ───────────────────────────────────────────────────── */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw] lg:hidden flex flex-col
          bg-[#0c0e15] border-l border-white/[0.08] shadow-2xl
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.07]">
          <Logo />
          <button
            onClick={() => setOpen(false)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/[0.07] transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV.map(l => (
            <MobileNavItem
              key={l.href}
              href={l.href}
              label={l.label}
              icon={l.icon}
              active={pathname === l.href}
              onClick={() => setOpen(false)}
            />
          ))}
        </nav>

        {/* Drawer footer — network + wallet */}
        <div className="px-4 py-5 border-t border-white/[0.07] space-y-3">
          {/* Network indicator */}
          <a
            href={explorerContractUrl(CONTRACT_CONFIG.contractId)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span>Connected to <span className="text-green-400 font-medium">{CONTRACT_CONFIG.network}</span></span>
          </a>
          {/* Wallet button full-width on mobile */}
          <div className="w-full">
            <WalletButton fullWidth />
          </div>
        </div>
      </div>
    </>
  );
}