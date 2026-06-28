"use client";

import { useWallet } from "@/hooks/use-wallet";
import { useMyBackedCampaigns, useCampaigns } from "@/hooks/use-campaigns";
import { TransactionHistory } from "@/components/shared/TransactionHistory";
import {
  shortenAddress,
  explorerAddressUrl,
  stroopsToXLM,
  formatXLM,
} from "@/lib/stellar-utils";
import { CONTRACT_CONFIG } from "@/lib/contract-config";
import Link from "next/link";

export default function DashboardPage() {
  const { address, isConnected, connect, balances, refreshBalances, network } =
    useWallet();
  const { data: backedIds } = useMyBackedCampaigns();
  const { data: allCampaigns } = useCampaigns();

  const xlmBalance = parseFloat(
    balances.find((b) => b.asset === "XLM")?.balance || "0",
  );

  const myCampaigns = allCampaigns?.filter(
    (c) => c.creator.toLowerCase() === (address?.toLowerCase() ?? ""),
  ) ?? [];

  const backedCampaigns = allCampaigns?.filter((c) =>
    backedIds?.includes(c.id),
  ) ?? [];

  const totalContributed = backedCampaigns.reduce(
    (acc, c) => acc + c.raised,
    0n,
  );

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-5xl mb-4">👛</p>
        <h1 className="text-2xl font-bold text-white mb-2">Wallet Dashboard</h1>
        <p className="text-white/50 mb-6">Connect your wallet to view your dashboard</p>
        <button
          onClick={connect}
          className="px-6 py-3 bg-gradient-to-r from-stellar-blue to-stellar-purple text-white font-medium rounded-xl"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>

      {/* Wallet overview */}
      <div className="card p-6 mb-6 bg-gradient-to-br from-stellar-blue/10 to-stellar-purple/10 border-stellar-blue/20">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-white/40 mb-1">Connected Address</p>
            <a
              href={explorerAddressUrl(address!)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-white/80 hover:text-white transition-colors"
            >
              {address}
            </a>
          </div>
          <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {network}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs text-white/40 mb-1">XLM Balance</p>
            <p className="text-xl font-bold text-white">
              {xlmBalance.toFixed(4)}
            </p>
            <p className="text-xs text-white/30">XLM</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs text-white/40 mb-1">My Campaigns</p>
            <p className="text-xl font-bold text-white">{myCampaigns.length}</p>
            <p className="text-xs text-white/30">created</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs text-white/40 mb-1">Backed</p>
            <p className="text-xl font-bold text-white">
              {backedCampaigns.length}
            </p>
            <p className="text-xs text-white/30">campaigns</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs text-white/40 mb-1">Contract</p>
            <p className="text-xs font-mono text-white/50 mt-1 break-all">
              {CONTRACT_CONFIG.contractId.slice(0, 8)}...
            </p>
          </div>
        </div>

        <button
          onClick={() => refreshBalances()}
          className="mt-4 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          ↻ Refresh balances
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Campaigns */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h3 className="font-semibold text-white text-sm">My Campaigns</h3>
            <Link
              href="/campaigns"
              className="text-xs text-stellar-blue hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
            {myCampaigns.length === 0 ? (
              <div className="py-8 text-center px-5">
                <p className="text-white/30 text-sm">No campaigns yet</p>
                <Link
                  href="/"
                  className="text-xs text-stellar-blue hover:underline mt-1 inline-block"
                >
                  Create your first →
                </Link>
              </div>
            ) : (
              myCampaigns.map((c) => (
                <Link
                  key={c.id.toString()}
                  href={`/campaigns/${c.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/80 truncate">{c.title}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {c.progress}% funded · {Number(c.backerCount)} backers
                    </p>
                  </div>
                  <span
                    className={`ml-3 shrink-0 text-xs px-2 py-0.5 rounded-full ${
                      c.status === "Active"
                        ? "text-blue-400 bg-blue-400/10"
                        : c.status === "Successful"
                        ? "text-green-400 bg-green-400/10"
                        : "text-gray-400 bg-gray-400/10"
                    }`}
                  >
                    {c.status}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Backed Campaigns */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h3 className="font-semibold text-white text-sm">Backed Campaigns</h3>
          </div>
          <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
            {backedCampaigns.length === 0 ? (
              <div className="py-8 text-center px-5">
                <p className="text-white/30 text-sm">Not backed any campaigns</p>
                <Link
                  href="/campaigns"
                  className="text-xs text-stellar-blue hover:underline mt-1 inline-block"
                >
                  Explore campaigns →
                </Link>
              </div>
            ) : (
              backedCampaigns.map((c) => (
                <Link
                  key={c.id.toString()}
                  href={`/campaigns/${c.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/80 truncate">{c.title}</p>
                    <p className="text-xs text-stellar-blue mt-0.5">
                      {c.progress}% funded
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="mt-6">
        <TransactionHistory />
      </div>
    </div>
  );
}
