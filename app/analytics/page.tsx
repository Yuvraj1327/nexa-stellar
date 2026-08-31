"use client";
import { useAnalytics } from "@/hooks/use-milestones";

function Stat({ icon, label, value, sub, color = "text-white" }: { icon: string; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
      <p className="text-xl mb-2">{icon}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-white/40 mt-1">{label}</p>
      {sub && <p className="text-xs text-white/20 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data, isLoading, dataUpdatedAt, refetch } = useAnalytics();
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-white/40 mt-1">Real on-chain platform metrics from Stellar Testnet</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Live
          </span>
          <button onClick={() => refetch()} className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-xl text-white/40 hover:text-white transition-colors">↻</button>
        </div>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 animate-pulse h-28" />)}
        </div>
      ) : !data ? (
        <div className="text-center py-20 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-white/50">No data yet — deploy the contract and create campaigns</p>
        </div>
      ) : (
        <>
          <div className="mb-2"><p className="text-xs text-white/30 uppercase tracking-wider mb-3">Campaigns</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat icon="📋" label="Total" value={data.totalCampaigns} />
              <Stat icon="⚡" label="Active" value={data.activeCampaigns} color="text-blue-400" />
              <Stat icon="🎉" label="Completed" value={data.completedCampaigns} color="text-green-400" />
              <Stat icon="📈" label="Success Rate" value={`${data.successRate}%`} color={data.successRate >= 50 ? "text-green-400" : "text-yellow-400"} />
            </div>
          </div>
          <div className="mt-6 mb-2"><p className="text-xs text-white/30 uppercase tracking-wider mb-3">XLM Volume</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat icon="💰" label="Total Raised" value={`${data.totalRaisedXLM.toLocaleString()} XLM`} />
              <Stat icon="🔒" label="In Escrow" value={`${data.totalEscrowedXLM.toLocaleString()} XLM`} color="text-yellow-400" sub="pending milestones" />
              <Stat icon="💸" label="Released" value={`${data.totalReleasedXLM.toLocaleString()} XLM`} color="text-green-400" sub="paid to creators" />
              <Stat icon="👥" label="Total Backers" value={data.totalBackers} color="text-stellar-blue" />
            </div>
          </div>
          <div className="mt-6 mb-2"><p className="text-xs text-white/30 uppercase tracking-wider mb-3">Milestones & Governance</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat icon="🏁" label="Total" value={data.totalMilestones} />
              <Stat icon="✅" label="Approved" value={data.approvedMilestones} color="text-green-400" />
              <Stat icon="❌" label="Rejected" value={data.rejectedMilestones} color="text-red-400" />
              <Stat icon="⏳" label="Pending" value={data.pendingMilestones} color="text-yellow-400" />
            </div>
          </div>
          {data.totalRaisedXLM > 0 && (
            <div className="mt-6 bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
              <p className="text-sm font-medium text-white/50 mb-4">Fund Distribution</p>
              {[
                { label: "Released to Creators", value: data.totalReleasedXLM, total: data.totalRaisedXLM, color: "from-green-500 to-emerald-400" },
                { label: "In Escrow (locked)", value: data.totalEscrowedXLM, total: data.totalRaisedXLM, color: "from-yellow-500 to-orange-400" },
              ].map((bar) => (
                <div key={bar.label} className="mb-3">
                  <div className="flex justify-between text-xs text-white/40 mb-1">
                    <span>{bar.label}</span>
                    <span>{Math.round((bar.value / bar.total) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${bar.color} rounded-full`} style={{ width: `${Math.round((bar.value / bar.total) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {dataUpdatedAt && <p className="text-xs text-white/20 mt-4 text-right">Updated: {new Date(dataUpdatedAt).toLocaleTimeString()}</p>}
        </>
      )}
    </div>
  );
}
