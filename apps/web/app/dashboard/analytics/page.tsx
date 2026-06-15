"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3, TrendingUp, Eye, Heart, MessageCircle, Share2,
  Clock, Target, Zap, Lightbulb, ArrowLeft, Loader2,
  Youtube, Instagram, Facebook, Linkedin, Twitter, TvMinimalPlay,
  Award, Timer, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";

const API = "http://localhost:4000";

const PLATFORM_COLORS: Record<string, { color: string; bg: string }> = {
  youtube: { color: "#FF0000", bg: "rgba(255,0,0,0.12)" },
  tiktok: { color: "#00f2ea", bg: "rgba(0,242,234,0.12)" },
  instagram: { color: "#E4405F", bg: "rgba(228,64,95,0.12)" },
  facebook: { color: "#1877F2", bg: "rgba(24,119,242,0.12)" },
  linkedin: { color: "#0A66C2", bg: "rgba(10,102,194,0.12)" },
  x: { color: "#1DA1F2", bg: "rgba(29,161,242,0.12)" },
};

const PLATFORM_ICONS: Record<string, any> = {
  youtube: Youtube, tiktok: TvMinimalPlay, instagram: Instagram,
  facebook: Facebook, linkedin: Linkedin, x: Twitter,
};

interface Report {
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalWatchTime: number;
  avgEngagementRate: number;
  avgRetention: number;
  platformBreakdown: Record<string, { views: number; likes: number; comments: number; shares: number; posts: number }>;
  trends: { date: string; views: number; likes: number }[];
}

interface Insight {
  bestPerformingCategory: { category: string; multiplier: number; description: (rtl: boolean) => string };
  bestPerformingClipLength: { lengthRange: string; retentionRate: number; description: (rtl: boolean) => string };
  bestPostingTime: { timeRange: string; engagementBoost: number; description: (rtl: boolean) => string };
  topPerformingTemplate: { templateName: string; retentionRatio: string; description: (rtl: boolean) => string };
  topPerformingCaptionStyle: { styleName: string; engagementRate: string; description: (rtl: boolean) => string };
}

export default function AnalyticsPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user]);

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const headers = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

  const loadData = async () => {
    setLoading(true);
    try {
      const [repRes, insRes] = await Promise.all([
        fetch(`${API}/analytics/report`, { headers: headers() }),
        fetch(`${API}/analytics/insights`, { headers: headers() }),
      ]);
      if (repRes.ok) setReport(await repRes.json());
      if (insRes.ok) setInsights(await insRes.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  };

  if (authLoading || loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0a0a0f" }}>
        <Loader2 size={40} style={{ animation: "spin 1s linear infinite", color: "#8b5cf6" }} />
      </div>
    );
  }

  const maxTrendViews = report?.trends ? Math.max(...report.trends.map(t => t.views), 1) : 1;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0f 0%, #1a1025 50%, #0a0a0f 100%)", color: "#fff" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px", borderBottom: "1px solid rgba(139,92,246,0.15)", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/dashboard">
          <Button variant="ghost" style={{ padding: 8 }}><ArrowLeft size={20} /></Button>
        </Link>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, background: "linear-gradient(135deg,#8b5cf6,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Analytics Dashboard
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>Track performance across all platforms</p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <Tabs
          tabs={[
            { id: "overview", label: "📊 Overview" },
            { id: "platforms", label: "🌐 Platforms" },
            { id: "insights", label: "🧠 AI Insights" },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div style={{ marginTop: 24 }}>
          {activeTab === "overview" && report && (
            <div>
              {/* KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
                {[
                  { label: "Total Views", value: formatNumber(report.totalViews), icon: Eye, color: "#8b5cf6", gradient: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))" },
                  { label: "Total Likes", value: formatNumber(report.totalLikes), icon: Heart, color: "#ef4444", gradient: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))" },
                  { label: "Comments", value: formatNumber(report.totalComments), icon: MessageCircle, color: "#06b6d4", gradient: "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(6,182,212,0.05))" },
                  { label: "Shares", value: formatNumber(report.totalShares), icon: Share2, color: "#22c55e", gradient: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))" },
                  { label: "Engagement", value: `${report.avgEngagementRate}%`, icon: Target, color: "#f59e0b", gradient: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))" },
                  { label: "Avg Retention", value: `${report.avgRetention}%`, icon: Timer, color: "#ec4899", gradient: "linear-gradient(135deg, rgba(236,72,153,0.15), rgba(236,72,153,0.05))" },
                  { label: "Watch Time", value: `${Math.floor(report.totalWatchTime / 60)}m`, icon: Clock, color: "#14b8a6", gradient: "linear-gradient(135deg, rgba(20,184,166,0.15), rgba(20,184,166,0.05))" },
                  { label: "Total Posts", value: report.totalPosts.toString(), icon: BarChart3, color: "#a855f7", gradient: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.05))" },
                ].map((kpi, idx) => {
                  const Icon = kpi.icon;
                  return (
                    <div key={idx} style={{
                      background: kpi.gradient, border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 16, padding: 20, position: "relative", overflow: "hidden"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>{kpi.label}</p>
                          <p style={{ fontSize: 28, fontWeight: 700, color: kpi.color }}>{kpi.value}</p>
                        </div>
                        <Icon size={24} color={kpi.color} style={{ opacity: 0.5 }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Trend Chart */}
              <div style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16, padding: 24, marginBottom: 24
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
                  <TrendingUp size={18} style={{ display: "inline", marginRight: 8, color: "#8b5cf6" }} />
                  7-Day Performance Trend
                </h3>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 180 }}>
                  {report.trends.map((t, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{formatNumber(t.views)}</span>
                      <div style={{
                        width: "100%", borderRadius: 8,
                        height: `${Math.max(10, (t.views / maxTrendViews) * 140)}px`,
                        background: `linear-gradient(180deg, #8b5cf6, #6d28d9)`,
                        transition: "height 0.6s ease",
                        position: "relative",
                      }}>
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0,
                          height: `${Math.max(5, (t.likes / maxTrendViews) * 140)}px`,
                          background: "rgba(6,182,212,0.5)", borderRadius: "0 0 8px 8px"
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#64748b" }}>{t.date}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 16, justifyContent: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "#8b5cf6" }} /> Views
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "#06b6d4" }} /> Likes
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "platforms" && report && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
              {Object.entries(report.platformBreakdown).map(([platform, data]) => {
                const pc = PLATFORM_COLORS[platform] || { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" };
                const Icon = PLATFORM_ICONS[platform] || BarChart3;
                const engagement = data.views > 0 ? ((data.likes + data.comments + data.shares) / data.views * 100).toFixed(1) : "0";
                return (
                  <div key={platform} style={{
                    background: "rgba(255,255,255,0.03)", border: `1px solid ${pc.color}20`,
                    borderRadius: 16, padding: 24, position: "relative", overflow: "hidden"
                  }}>
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 3,
                      background: `linear-gradient(90deg, ${pc.color}, transparent)`
                    }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: pc.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={22} color={pc.color} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 17, fontWeight: 600, textTransform: "capitalize" }}>{platform}</h3>
                        <p style={{ color: "#64748b", fontSize: 13 }}>{data.posts} posts published</p>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {[
                        { label: "Views", value: formatNumber(data.views), icon: Eye },
                        { label: "Likes", value: formatNumber(data.likes), icon: Heart },
                        { label: "Comments", value: formatNumber(data.comments), icon: MessageCircle },
                        { label: "Engagement", value: `${engagement}%`, icon: Target },
                      ].map((m, idx) => {
                        const MIcon = m.icon;
                        return (
                          <div key={idx} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <MIcon size={13} color="#64748b" />
                              <span style={{ fontSize: 12, color: "#64748b" }}>{m.label}</span>
                            </div>
                            <p style={{ fontSize: 20, fontWeight: 700, color: pc.color }}>{m.value}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "insights" && insights && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { key: "bestPerformingCategory", icon: Award, color: "#f59e0b", title: "Best Category", subtitle: insights.bestPerformingCategory?.category, detail: `${insights.bestPerformingCategory?.multiplier}x performance multiplier`, desc: insights.bestPerformingCategory?.description?.(false) || insights.bestPerformingCategory?.description },
                { key: "bestPerformingClipLength", icon: Timer, color: "#8b5cf6", title: "Optimal Clip Length", subtitle: insights.bestPerformingClipLength?.lengthRange, detail: `${insights.bestPerformingClipLength?.retentionRate}% retention`, desc: insights.bestPerformingClipLength?.description?.(false) || insights.bestPerformingClipLength?.description },
                { key: "bestPostingTime", icon: Clock, color: "#06b6d4", title: "Best Posting Time", subtitle: insights.bestPostingTime?.timeRange, detail: `+${insights.bestPostingTime?.engagementBoost}% engagement`, desc: insights.bestPostingTime?.description?.(false) || insights.bestPostingTime?.description },
                { key: "topPerformingTemplate", icon: Sparkles, color: "#ec4899", title: "Top Template", subtitle: insights.topPerformingTemplate?.templateName, detail: `${insights.topPerformingTemplate?.retentionRatio} retention ratio`, desc: insights.topPerformingTemplate?.description?.(false) || insights.topPerformingTemplate?.description },
                { key: "topPerformingCaptionStyle", icon: Lightbulb, color: "#22c55e", title: "Best Caption Style", subtitle: insights.topPerformingCaptionStyle?.styleName, detail: `${insights.topPerformingCaptionStyle?.engagementRate} engagement rate`, desc: insights.topPerformingCaptionStyle?.description?.(false) || insights.topPerformingCaptionStyle?.description },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.key} style={{
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16, padding: 24, display: "flex", gap: 20, alignItems: "flex-start"
                  }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={26} color={item.color} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <h3 style={{ fontSize: 17, fontWeight: 600 }}>{item.title}</h3>
                        <span style={{ fontSize: 13, fontWeight: 600, padding: "3px 10px", borderRadius: 8, background: `${item.color}18`, color: item.color }}>
                          {item.subtitle}
                        </span>
                      </div>
                      <p style={{ color: item.color, fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{item.detail}</p>
                      <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
