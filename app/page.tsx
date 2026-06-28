"use client";

import { useState } from "react";
import Link from "next/link";
import { useCampaigns, useCampaignCount } from "@/hooks/use-campaigns";
import { CampaignCard, CampaignCardSkeleton } from "@/components/campaign/CampaignCard";
import { CreateCampaignModal } from "@/components/campaign/CreateCampaignModal";
import { useWallet } from "@/hooks/use-wallet";
import { formatXLM } from "@/lib/stellar-utils";
import { CONTRACT_CONFIG } from "@/lib/contract-config";
import { explorerContractUrl } from "@/lib/stellar-utils";

export default function HomePage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: campaigns, isLoading } = useCampaigns();
  const { data: count } = useCampaignCount();
  const { connect, isConnected } = useWallet();

  const activeCampaigns = campaigns?.filter((c) => c.status === "Active") ?? [];
  const successfulCampaigns = campaigns?.filter((c) => c.status === "Successful") ?? [];
  const totalRaised = campaigns?.reduce((acc, c) => acc + c.raised, 0n) ?? 0n;

  return (
    <>
      {showCreate && <CreateCampaignModal onClose={() => setShowCreate(false)} />}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {/* Hero */}
        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stellar-blue/10 border border-stellar-blue/20 text-stellar-blue text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-stellar-blue animate-pulse" />
            Live on Stellar {CONTRACT_CONFIG.network}
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-4 leading-tight">
            Fund the Future
            <br />
            <span className="text-gradient">on Stellar</span>
          </h1>
          <p className="text-lg text-white/50 max-w-xl mx-auto mb-8">
            Trustless crowdfunding powered by Soroban smart contracts.
            Launch your project, receive contributions, and build with the community.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => setShowCreate(true)}
              className="px-6 py-3 bg-gradient-to-r from-stellar-blue to-stellar-purple text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-stellar-blue/25 transition-all duration-200"
            >
              Launch Campaign 🚀
            </button>
            <Link
              href="/send"
              className="px-6 py-3 bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 rounded-xl font-medium transition-all"
            >
              Send XLM 💸
            </Link>
            <Link
              href="/campaigns"
              className="px-6 py-3 border border-white/10 text-white/50 hover:text-white hover:bg-white/5 rounded-xl font-medium transition-all"
            >
              Explore Projects →
            </Link>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          {[
            {
              label: "Total Campaigns",
              value: campaigns?.length ?? "—",
              icon: "📋",
            },
            {
              label: "Active Now",
              value: activeCampaigns.length,
              icon: "⚡",
            },
            {
              label: "Total Raised",
              value: `${formatXLM(totalRaised)} XLM`,
              icon: "💰",
            },
            {
              label: "Successful",
              value: successfulCampaigns.length,
              icon: "🎉",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="card p-5 text-center"
            >
              <p className="text-2xl mb-2">{stat.icon}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-white/40 mt-1">{stat.label}</p>
            </div>
          ))}
        </section>

        {/* Contract info */}
        <section className="mb-10 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-stellar-blue/10 flex items-center justify-center text-sm">
              📦
            </div>
            <div>
              <p className="text-xs text-white/40">Smart Contract</p>
              <p className="text-xs font-mono text-white/60">
                {CONTRACT_CONFIG.contractId === "CONTRACT_ADDRESS_HERE"
                  ? "Deploy contract first (node scripts/deploy.mjs)"
                  : CONTRACT_CONFIG.contractId.slice(0, 20) + "..."}
              </p>
            </div>
          </div>
          <a
            href={explorerContractUrl(CONTRACT_CONFIG.contractId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-stellar-blue hover:underline"
          >
            View on Explorer ↗
          </a>
        </section>

        {/* Active Campaigns */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Active Campaigns</h2>
              <p className="text-sm text-white/40 mt-0.5">
                Fund projects making an impact
              </p>
            </div>
            <Link
              href="/campaigns"
              className="text-sm text-stellar-blue hover:underline"
            >
              View all →
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <CampaignCardSkeleton key={i} />
              ))}
            </div>
          ) : activeCampaigns.length === 0 ? (
            <div className="text-center py-20 card">
              <p className="text-4xl mb-3">🌱</p>
              <p className="text-white/60 font-medium">No active campaigns yet</p>
              <p className="text-white/30 text-sm mt-1 mb-4">
                Be the first to launch a campaign
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="px-5 py-2 bg-stellar-blue/10 border border-stellar-blue/30 text-stellar-blue rounded-xl text-sm font-medium hover:bg-stellar-blue/20 transition-colors"
              >
                Create Campaign
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeCampaigns.slice(0, 6).map((c) => (
                <CampaignCard key={c.id.toString()} campaign={c} />
              ))}
            </div>
          )}
        </section>

        {/* How it works */}
        <section className="mt-20 text-center">
          <h2 className="text-3xl font-bold text-white mb-2">How It Works</h2>
          <p className="text-white/40 mb-10">
            Powered by Soroban smart contracts on Stellar
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                icon: "🚀",
                title: "Launch",
                desc: "Create a campaign with your goal and timeline. Deploy directly to Stellar blockchain.",
              },
              {
                step: "02",
                icon: "💰",
                title: "Fund",
                desc: "Backers contribute XLM. Funds are tracked transparently on-chain.",
              },
              {
                step: "03",
                icon: "🎉",
                title: "Build",
                desc: "Reach your goal and claim funds. Build what you promised.",
              },
            ].map((item) => (
              <div key={item.step} className="card p-6 text-left group hover:border-white/15 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-mono text-white/20">{item.step}</span>
                  <span className="text-2xl">{item.icon}</span>
                </div>
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/40">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
