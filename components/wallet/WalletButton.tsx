"use client";

import { useWallet } from "@/hooks/use-wallet";
import { shortenAddress, explorerAddressUrl } from "@/lib/stellar-utils";
import { useState } from "react";

interface WalletButtonProps {
  /** When true, button fills its container width (used in mobile drawer) */
  fullWidth?: boolean;
}

export function WalletButton({ fullWidth = false }: WalletButtonProps) {
  const { address, isConnected, isConnecting, connect, disconnect, balances, network } =
    useWallet();
  const [showMenu, setShowMenu] = useState(false);

  const xlmBalance = balances.find((b) => b.asset === "XLM");

  // ── Disconnected ──────────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        className={`relative group flex items-center justify-center gap-2 px-4 py-2 rounded-xl
          bg-gradient-to-r from-stellar-blue to-stellar-purple text-white font-medium text-sm
          transition-all duration-200 hover:shadow-lg hover:shadow-stellar-blue/25
          disabled:opacity-60 disabled:cursor-not-allowed
          ${fullWidth ? "w-full" : ""}`}
      >
        {isConnecting ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Connecting…</span>
          </>
        ) : (
          <>
            <WalletIcon />
            <span>Connect Wallet</span>
          </>
        )}
      </button>
    );
  }

  // ── Connected ─────────────────────────────────────────────────────────────

  return (
    <div className={`relative ${fullWidth ? "w-full" : ""}`}>
      <button
        onClick={() => setShowMenu((v) => !v)}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl
          bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] hover:border-white/20
          transition-all duration-200 ${fullWidth ? "w-full justify-between" : ""}`}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
          <span className="text-sm font-mono text-white/85">
            {shortenAddress(address!, 4)}
          </span>
        </div>
        {xlmBalance && (
          <span className="hidden sm:inline-flex text-xs text-white/50 bg-white/[0.06] px-2 py-0.5 rounded-lg">
            {parseFloat(xlmBalance.balance).toFixed(2)} XLM
          </span>
        )}
        <svg className="w-3 h-3 text-white/30 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={showMenu ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
        </svg>
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />

          {/* Dropdown */}
          <div className={`absolute z-50 mt-2 w-64 bg-[#0f1117] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden
            ${fullWidth ? "left-0 right-0 w-full" : "right-0"}`}>

            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-stellar-blue/10 to-stellar-purple/10 border-b border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-xs text-green-400 font-medium capitalize">
                  {network}
                </span>
              </div>
              <p className="font-mono text-xs text-white/80 break-all leading-relaxed">
                {address}
              </p>
            </div>

            {/* Balance */}
            {xlmBalance && (
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-xs text-white/40 mb-1">Balance</p>
                <p className="text-lg font-bold text-white">
                  {parseFloat(xlmBalance.balance).toFixed(4)}{" "}
                  <span className="text-white/50 text-sm font-normal">XLM</span>
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="p-2">
              <a
                href={explorerAddressUrl(address!)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors"
                onClick={() => setShowMenu(false)}
              >
                <ExternalLinkIcon />
                View on Explorer
              </a>
              <button
                onClick={() => { disconnect(); setShowMenu(false); }}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/[0.07] rounded-xl transition-colors"
              >
                <DisconnectIcon />
                Disconnect
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function WalletIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function DisconnectIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}