"use client";
import { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import type { FeedbackType, FeedbackRating, FeedbackEntry } from "@/types/index";

const generateId = () => Math.random().toString(36).slice(2, 11);
const TYPES: { value: FeedbackType; label: string; icon: string }[] = [
  { value: "general", label: "General", icon: "💬" },
  { value: "bug", label: "Bug Report", icon: "🐛" },
  { value: "feature", label: "Feature Request", icon: "✨" },
  { value: "ux", label: "UX Feedback", icon: "🎨" },
];

function saveFb(e: FeedbackEntry) {
  try { const ex = JSON.parse(localStorage.getItem("nexa-feedback") || "[]"); ex.unshift(e); localStorage.setItem("nexa-feedback", JSON.stringify(ex.slice(0, 50))); } catch {}
}
function loadFb(): FeedbackEntry[] {
  try { return JSON.parse(localStorage.getItem("nexa-feedback") || "[]"); } catch { return []; }
}

export default function FeedbackPage() {
  const { address } = useWallet();
  const [type, setType] = useState<FeedbackType>("general");
  const [rating, setRating] = useState<FeedbackRating>(5);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState<FeedbackEntry[]>(loadFb);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    const entry: FeedbackEntry = { id: generateId(), type, rating, message: message.trim(), walletAddress: address || undefined, timestamp: Date.now() };
    saveFb(entry);
    setHistory(loadFb());
    setMessage("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Feedback</h1>
        <p className="text-white/40 mt-1">Help us improve Nexa — your input shapes the product</p>
      </div>
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-8">
        {submitted ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🎉</p>
            <p className="text-lg font-bold text-white mb-1">Thank you!</p>
            <p className="text-white/50 text-sm">Your feedback has been saved.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setType(t.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border transition-all ${type === t.value ? "border-stellar-blue bg-stellar-blue/10 text-stellar-blue" : "border-white/10 text-white/50 hover:border-white/20"}`}>
                    <span>{t.icon}</span><span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Rating</label>
              <div className="flex gap-2">
                {([1, 2, 3, 4, 5] as FeedbackRating[]).map(r => (
                  <button key={r} type="button" onClick={() => setRating(r)}
                    className={`flex-1 py-2 rounded-xl text-xl transition-all ${rating >= r ? "text-yellow-400" : "text-white/20"}`}>★</button>
                ))}
              </div>
              <p className="text-xs text-white/30 mt-1 text-center">{["", "Very Poor", "Poor", "Okay", "Good", "Excellent!"][rating]}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Your feedback</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell us what you think, what's broken, or what you'd love to see..." rows={4} required maxLength={500}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-stellar-blue/50 resize-none" />
              <p className="text-xs text-white/20 mt-1 text-right">{message.length}/500</p>
            </div>
            {address && <p className="text-xs text-white/30">As: <span className="font-mono">{address.slice(0,8)}...{address.slice(-6)}</span></p>}
            <button type="submit" disabled={!message.trim()}
              className="w-full py-3 bg-gradient-to-r from-stellar-blue to-stellar-purple text-white font-medium rounded-xl disabled:opacity-50 hover:shadow-lg transition-all">
              Submit Feedback 🚀
            </button>
          </form>
        )}
      </div>
      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-white/40 mb-3 uppercase tracking-wider">Recent ({history.length})</h3>
          <div className="space-y-3">
            {history.slice(0, 5).map(f => (
              <div key={f.id} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/40 capitalize">{TYPES.find(t => t.value === f.type)?.icon} {f.type}</span>
                  <span className="text-xs">{Array.from({length:5},(_,i)=><span key={i} className={i < f.rating ? "text-yellow-400" : "text-white/10"}>★</span>)}</span>
                </div>
                <p className="text-sm text-white/70">{f.message}</p>
                <p className="text-xs text-white/20 mt-2">{new Date(f.timestamp).toLocaleDateString()}{f.walletAddress && ` · ${f.walletAddress.slice(0,6)}...`}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
