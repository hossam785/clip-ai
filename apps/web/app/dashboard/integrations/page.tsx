"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Youtube, Instagram, Facebook, Linkedin, Twitter, TvMinimalPlay,
  Link2, Unlink, Send, Calendar, Clock, ExternalLink, Copy,
  Loader2, CheckCircle2, XCircle, ArrowLeft, RotateCcw,
  Eye, Heart, MessageCircle, Share2
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";

const API = "http://localhost:4000";

const PROVIDERS = [
  { id: "youtube", name: "YouTube", icon: Youtube, color: "#FF0000", bg: "rgba(255,0,0,0.1)" },
  { id: "tiktok", name: "TikTok", icon: TvMinimalPlay, color: "#00f2ea", bg: "rgba(0,242,234,0.1)" },
  { id: "instagram", name: "Instagram", icon: Instagram, color: "#E4405F", bg: "rgba(228,64,95,0.1)" },
  { id: "facebook", name: "Facebook", icon: Facebook, color: "#1877F2", bg: "rgba(24,119,242,0.1)" },
  { id: "linkedin", name: "LinkedIn", icon: Linkedin, color: "#0A66C2", bg: "rgba(10,102,194,0.1)" },
  { id: "x", name: "X (Twitter)", icon: Twitter, color: "#1DA1F2", bg: "rgba(29,161,242,0.1)" },
];

interface ConnectedAccount {
  id: string;
  provider: string;
  accountName: string;
  accountId: string;
  createdAt: string;
}

interface PublishedPost {
  id: string;
  clipId: string;
  provider: string;
  postId: string;
  status: string;
  postUrl: string;
  title: string;
  description: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  createdAt: string;
  clip?: { title: string };
}

interface PostSchedule {
  id: string;
  clipId: string;
  provider: string;
  scheduledFor: string;
  status: string;
  title: string;
  description: string;
  clip?: { title: string };
}

export default function IntegrationsPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [history, setHistory] = useState<PublishedPost[]>([]);
  const [schedules, setSchedules] = useState<PostSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectModal, setConnectModal] = useState<string | null>(null);
  const [connectName, setConnectName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState("accounts");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user]);

  useEffect(() => {
    if (token) loadAll();
  }, [token]);

  const headers = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [accRes, histRes, schRes] = await Promise.all([
        fetch(`${API}/integrations/accounts`, { headers: headers() }),
        fetch(`${API}/integrations/history`, { headers: headers() }),
        fetch(`${API}/integrations/schedules`, { headers: headers() }),
      ]);
      if (accRes.ok) setAccounts(await accRes.json());
      if (histRes.ok) setHistory(await histRes.json());
      if (schRes.ok) setSchedules(await schRes.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const connectAccount = async () => {
    if (!connectModal || !connectName.trim()) return;
    setConnecting(true);
    try {
      const res = await fetch(`${API}/integrations/connect-mock`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ provider: connectModal, accountName: connectName }),
      });
      if (res.ok) {
        toastSuccess(`Connected to ${connectModal} successfully!`);
        setConnectModal(null);
        setConnectName("");
        loadAll();
      }
    } catch { toastError("Connection failed"); }
    setConnecting(false);
  };

  const disconnectAccount = async (id: string) => {
    try {
      await fetch(`${API}/integrations/accounts/${id}`, { method: "DELETE", headers: headers() });
      toastSuccess("Account disconnected");
      loadAll();
    } catch { toastError("Failed to disconnect"); }
  };

  const cancelSchedule = async (id: string) => {
    try {
      await fetch(`${API}/integrations/schedules/${id}`, { method: "DELETE", headers: headers() });
      toastSuccess("Schedule cancelled");
      loadAll();
    } catch { toastError("Failed to cancel schedule"); }
  };

  const duplicatePost = async (postId: string) => {
    try {
      const res = await fetch(`${API}/integrations/duplicate/${postId}`, { method: "POST", headers: headers() });
      if (res.ok) {
        toastSuccess("Post duplicated as new schedule");
        loadAll();
      }
    } catch { toastError("Failed to duplicate post"); }
  };

  if (authLoading || loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0a0a0f" }}>
        <Loader2 size={40} style={{ animation: "spin 1s linear infinite", color: "#8b5cf6" }} />
      </div>
    );
  }

  const getProviderInfo = (id: string) => PROVIDERS.find(p => p.id === id) || PROVIDERS[0];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0f 0%, #1a1025 50%, #0a0a0f 100%)", color: "#fff" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px", borderBottom: "1px solid rgba(139,92,246,0.15)", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/dashboard">
          <Button variant="ghost" style={{ padding: 8 }}><ArrowLeft size={20} /></Button>
        </Link>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, background: "linear-gradient(135deg,#8b5cf6,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Social Media Hub
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>Connect accounts, publish clips, and manage schedules</p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <Tabs
          tabs={[
            { id: "accounts", label: `🔗 Connected Accounts (${accounts.length})` },
            { id: "history", label: `📤 Publish History (${history.length})` },
            { id: "schedules", label: `📅 Scheduled (${schedules.filter(s => s.status === "SCHEDULED").length})` },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div style={{ marginTop: 24 }}>
          {activeTab === "accounts" && (
            <div>
              {/* Provider Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
                {PROVIDERS.map(p => {
                  const connected = accounts.find(a => a.provider === p.id);
                  const Icon = p.icon;
                  return (
                    <div key={p.id} style={{
                      background: "rgba(255,255,255,0.03)", border: `1px solid ${connected ? p.color + '40' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 16, padding: 24, transition: "all 0.3s", cursor: "pointer",
                      position: "relative", overflow: "hidden"
                    }}>
                      {connected && (
                        <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(34,197,94,0.15)", color: "#22c55e", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20 }}>
                          Connected
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: p.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={24} color={p.color} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: 18, fontWeight: 600 }}>{p.name}</h3>
                          {connected && <p style={{ color: "#94a3b8", fontSize: 13 }}>@{connected.accountName}</p>}
                        </div>
                      </div>
                      {connected ? (
                        <Button variant="outline" onClick={() => disconnectAccount(connected.id)}
                          style={{ width: "100%", borderColor: "rgba(239,68,68,0.3)", color: "#ef4444" }}>
                          <Unlink size={16} style={{ marginRight: 8 }} /> Disconnect
                        </Button>
                      ) : (
                        <Button variant="primary" onClick={() => setConnectModal(p.id)}
                          style={{ width: "100%", background: `linear-gradient(135deg, ${p.color}, ${p.color}88)` }}>
                          <Link2 size={16} style={{ marginRight: 8 }} /> Connect
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div>
              {history.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
                  <Send size={48} style={{ margin: "0 auto 16px", opacity: 0.4 }} />
                  <p style={{ fontSize: 18, fontWeight: 500 }}>No published posts yet</p>
                  <p style={{ fontSize: 14 }}>Publish a clip from the editor to see it here</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {history.map(post => {
                    const prov = getProviderInfo(post.provider);
                    const Icon = prov.icon;
                    return (
                      <div key={post.id} style={{
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 14, padding: 20, display: "flex", alignItems: "center", gap: 16
                      }}>
                        <div style={{ width: 44, height: 44, borderRadius: 10, background: prov.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={22} color={prov.color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <h4 style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {post.title || post.clip?.title || "Untitled"}
                            </h4>
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                              background: post.status === "PUBLISHED" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                              color: post.status === "PUBLISHED" ? "#22c55e" : "#ef4444"
                            }}>
                              {post.status}
                            </span>
                          </div>
                          <p style={{ color: "#64748b", fontSize: 12 }}>{new Date(post.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div style={{ display: "flex", gap: 16, color: "#94a3b8", fontSize: 13 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Eye size={14} /> {post.views}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Heart size={14} /> {post.likes}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MessageCircle size={14} /> {post.comments}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Share2 size={14} /> {post.shares}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          {post.postUrl && (
                            <a href={post.postUrl} target="_blank" rel="noopener">
                              <Button variant="ghost" style={{ padding: 8 }}><ExternalLink size={16} /></Button>
                            </a>
                          )}
                          <Button variant="ghost" style={{ padding: 8 }} onClick={() => duplicatePost(post.id)}>
                            <Copy size={16} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "schedules" && (
            <div>
              {schedules.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
                  <Calendar size={48} style={{ margin: "0 auto 16px", opacity: 0.4 }} />
                  <p style={{ fontSize: 18, fontWeight: 500 }}>No scheduled posts</p>
                  <p style={{ fontSize: 14 }}>Schedule a clip to publish later</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {schedules.map(sch => {
                    const prov = getProviderInfo(sch.provider);
                    const Icon = prov.icon;
                    const statusColors: Record<string, { bg: string; color: string }> = {
                      SCHEDULED: { bg: "rgba(59,130,246,0.15)", color: "#3b82f6" },
                      PUBLISHED: { bg: "rgba(34,197,94,0.15)", color: "#22c55e" },
                      FAILED: { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
                      CANCELLED: { bg: "rgba(107,114,128,0.15)", color: "#6b7280" },
                    };
                    const sc = statusColors[sch.status] || statusColors.SCHEDULED;
                    return (
                      <div key={sch.id} style={{
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 14, padding: 20, display: "flex", alignItems: "center", gap: 16
                      }}>
                        <div style={{ width: 44, height: 44, borderRadius: 10, background: prov.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={22} color={prov.color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontSize: 15, fontWeight: 600 }}>{sch.title || sch.clip?.title || "Untitled"}</h4>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                            <Clock size={13} color="#64748b" />
                            <span style={{ color: "#94a3b8", fontSize: 13 }}>
                              {new Date(sch.scheduledFor).toLocaleString()}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: sc.bg, color: sc.color }}>
                              {sch.status}
                            </span>
                          </div>
                        </div>
                        {sch.status === "SCHEDULED" && (
                          <Button variant="outline" onClick={() => cancelSchedule(sch.id)}
                            style={{ borderColor: "rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13 }}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Connect Modal */}
      <Modal isOpen={!!connectModal} onClose={() => { setConnectModal(null); setConnectName(""); }}
        title={`Connect ${connectModal ? getProviderInfo(connectModal).name : ""}`}>
        <div style={{ padding: 16 }}>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 16 }}>
            Enter your account username to connect (mock OAuth flow).
          </p>
          <Input label="Account Username" placeholder="@youraccount" value={connectName} onChange={e => setConnectName(e.target.value)} />
          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <Button variant="ghost" onClick={() => setConnectModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={connectAccount} disabled={connecting || !connectName.trim()}>
              {connecting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} /> : <Link2 size={16} style={{ marginRight: 8 }} />}
              Connect
            </Button>
          </div>
        </div>
      </Modal>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
