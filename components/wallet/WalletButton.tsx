"use client";

import { useWallet } from "@/hooks/use-wallet";
import { shortenAddress, explorerAddressUrl } from "@/lib/stellar-utils";
import { useState } from "react";

export function WalletButton() {
  const { address, isConnected, isConnecting, connect, disconnect, balances, network } =
    useWallet();
  const [showMenu, setShowMenu] = useState(false);

  const xlmBalance = balances.find((b) => b.asset === "XLM");

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        className="relative group flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-stellar-blue to-stellar-purple text-white font-medium text-sm transition-all duration-200 hover:shadow-lg hover:shadow-stellar-blue/25 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isConnecting ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <WalletIcon />
            Connect Wallet
          </>
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu((v) => !v)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-mono text-white/80">
            {shortenAddress(address!, 4)}
          </span>
        </div>
        {xlmBalance && (
          <span className="text-xs text-white/50 bg-white/5 px-2 py-0.5 rounded-lg">
            {parseFloat(xlmBalance.balance).toFixed(2)} XLM
          </span>
        )}
        <span className="text-white/30 text-xs">▾</span>
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 mt-2 w-64 z-50 bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-stellar-blue/10 to-stellar-purple/10 border-b border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-xs text-green-400 font-medium">
                  Connected · {network}
                </span>
              </div>
              <p className="font-mono text-sm text-white/90 break-all">
                {address}
              </p>
            </div>

            {/* Balance */}
            {xlmBalance && (
              <div className="p-4 border-b border-white/5">
                <p className="text-xs text-white/40 mb-1">Balance</p>
                <p className="text-lg font-bold text-white">
                  {parseFloat(xlmBalance.balance).toFixed(4)}{" "}
                  <span className="text-white/60 text-sm font-normal">XLM</span>
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="p-2">
              <a
                href={explorerAddressUrl(address!)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                onClick={() => setShowMenu(false)}
              >
                <ExternalLinkIcon />
                View on Explorer
              </a>
              <button
                onClick={() => {
                  disconnect();
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 rounded-xl transition-colors"
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

function WalletIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

function DisconnectIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}
