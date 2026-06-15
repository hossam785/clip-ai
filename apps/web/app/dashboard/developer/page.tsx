"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Key, Webhook, Workflow, Plus, Trash2, Copy, Shield,
  ArrowLeft, Loader2, Eye, EyeOff, ToggleLeft, ToggleRight,
  Code2, Zap, CheckCircle2, XCircle, Clock
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { Dropdown } from "@/components/ui/Dropdown";
import { useToast } from "@/components/ui/Toast";

const API = "http://localhost:4000";

const WEBHOOK_EVENTS = [
  "CLIP_GENERATED", "VIDEO_UPLOADED", "EXPORT_COMPLETED",
  "POST_PUBLISHED", "PROCESSING_DONE", "SUBSCRIPTION_CHANGED",
];

const WORKFLOW_TRIGGERS = [
  { value: "CLIP_GENERATED", label: "When clip is generated" },
  { value: "VIDEO_UPLOADED", label: "When video is uploaded" },
  { value: "EXPORT_COMPLETED", label: "When export completes" },
];

const WORKFLOW_ACTIONS = [
  { value: "AUTO_EXPORT", label: "Auto export clip" },
  { value: "AUTO_PUBLISH", label: "Auto publish to platform" },
  { value: "AUTO_TRANSCRIPT", label: "Auto generate transcript" },
];

interface ApiKeyItem {
  id: string;
  name: string;
  key: string;
  status: string;
  requestLimit: number;
  requestCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

interface WebhookItem {
  id: string;
  url: string;
  secret: string;
  events: string;
  status: string;
  createdAt: string;
}

interface WorkflowItem {
  id: string;
  name: string;
  trigger: string;
  action: string;
  status: string;
  config: string;
  createdAt: string;
  executions: { id: string; status: string; createdAt: string }[];
}

export default function DeveloperPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();

  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("api-keys");

  // Modals
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKeyValue, setShowKeyValue] = useState<Record<string, boolean>>({});

  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);

  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [wfName, setWfName] = useState("");
  const [wfTrigger, setWfTrigger] = useState("");
  const [wfAction, setWfAction] = useState("");

  const [creatingKey, setCreatingKey] = useState(false);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);

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
      const [keysRes, whRes, wfRes] = await Promise.all([
        fetch(`${API}/developer/api-keys`, { headers: headers() }),
        fetch(`${API}/developer/webhooks`, { headers: headers() }),
        fetch(`${API}/developer/workflows`, { headers: headers() }),
      ]);
      if (keysRes.ok) setApiKeys(await keysRes.json());
      if (whRes.ok) setWebhooks(await whRes.json());
      if (wfRes.ok) setWorkflows(await wfRes.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // API Key actions
  const createApiKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const res = await fetch(`${API}/developer/api-keys`, {
        method: "POST", headers: headers(),
        body: JSON.stringify({ name: newKeyName }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.key);
        toastSuccess("API key created! Copy it now — it won't be shown again.");
        loadAll();
      }
    } catch { toastError("Failed to create API key"); }
    setCreatingKey(false);
  };

  const revokeKey = async (id: string) => {
    await fetch(`${API}/developer/api-keys/${id}/revoke`, { method: "PUT", headers: headers() });
    toastSuccess("API key revoked");
    loadAll();
  };

  const deleteKey = async (id: string) => {
    await fetch(`${API}/developer/api-keys/${id}`, { method: "DELETE", headers: headers() });
    toastSuccess("API key deleted");
    loadAll();
  };

  // Webhook actions
  const createWebhook = async () => {
    if (!webhookUrl.trim() || webhookEvents.length === 0) return;
    setCreatingWebhook(true);
    try {
      const res = await fetch(`${API}/developer/webhooks`, {
        method: "POST", headers: headers(),
        body: JSON.stringify({ url: webhookUrl, events: webhookEvents }),
      });
      if (res.ok) {
        toastSuccess("Webhook created");
        setShowWebhookModal(false);
        setWebhookUrl("");
        setWebhookEvents([]);
        loadAll();
      }
    } catch { toastError("Failed to create webhook"); }
    setCreatingWebhook(false);
  };

  const deleteWebhook = async (id: string) => {
    await fetch(`${API}/developer/webhooks/${id}`, { method: "DELETE", headers: headers() });
    toastSuccess("Webhook deleted");
    loadAll();
  };

  // Workflow actions
  const createWorkflow = async () => {
    if (!wfName.trim() || !wfTrigger || !wfAction) return;
    setCreatingWorkflow(true);
    try {
      const res = await fetch(`${API}/developer/workflows`, {
        method: "POST", headers: headers(),
        body: JSON.stringify({ name: wfName, trigger: wfTrigger, action: wfAction, config: {} }),
      });
      if (res.ok) {
        toastSuccess("Workflow rule created");
        setShowWorkflowModal(false);
        setWfName(""); setWfTrigger(""); setWfAction("");
        loadAll();
      }
    } catch { toastError("Failed to create workflow"); }
    setCreatingWorkflow(false);
  };

  const toggleWorkflow = async (id: string, current: string) => {
    const newStatus = current === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await fetch(`${API}/developer/workflows/${id}`, {
      method: "PUT", headers: headers(),
      body: JSON.stringify({ status: newStatus }),
    });
    loadAll();
  };

  const deleteWorkflow = async (id: string) => {
    await fetch(`${API}/developer/workflows/${id}`, { method: "DELETE", headers: headers() });
    toastSuccess("Workflow deleted");
    loadAll();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toastSuccess("Copied to clipboard");
  };

  const maskKey = (key: string) => key.substring(0, 12) + "•".repeat(20) + key.substring(key.length - 4);

  if (authLoading || loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0a0a0f" }}>
        <Loader2 size={40} style={{ animation: "spin 1s linear infinite", color: "#8b5cf6" }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0f 0%, #1a1025 50%, #0a0a0f 100%)", color: "#fff" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px", borderBottom: "1px solid rgba(139,92,246,0.15)", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/dashboard">
          <Button variant="ghost" style={{ padding: 8 }}><ArrowLeft size={20} /></Button>
        </Link>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, background: "linear-gradient(135deg,#8b5cf6,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Developer Portal
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>API Keys, Webhooks & Automation</p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <Tabs
          tabs={[
            { id: "api-keys", label: `🔑 API Keys (${apiKeys.length})` },
            { id: "webhooks", label: `🔗 Webhooks (${webhooks.length})` },
            { id: "workflows", label: `⚡ Automation (${workflows.length})` },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div style={{ marginTop: 24 }}>
          {/* ====== API KEYS ====== */}
          {activeTab === "api-keys" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Manage API keys for programmatic access to Clip AI</p>
                <Button variant="primary" onClick={() => { setShowKeyModal(true); setCreatedKey(null); setNewKeyName(""); }}>
                  <Plus size={16} style={{ marginRight: 8 }} /> New API Key
                </Button>
              </div>

              {apiKeys.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
                  <Key size={48} style={{ margin: "0 auto 16px", opacity: 0.4 }} />
                  <p style={{ fontSize: 18, fontWeight: 500 }}>No API keys yet</p>
                  <p style={{ fontSize: 14 }}>Create one to access the Clip AI API</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {apiKeys.map(k => (
                    <div key={k.id} style={{
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 14, padding: 20
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Key size={18} color="#8b5cf6" />
                          <h4 style={{ fontSize: 16, fontWeight: 600 }}>{k.name}</h4>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                            background: k.status === "ACTIVE" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                            color: k.status === "ACTIVE" ? "#22c55e" : "#ef4444"
                          }}>
                            {k.status}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          {k.status === "ACTIVE" && (
                            <Button variant="outline" onClick={() => revokeKey(k.id)} style={{ fontSize: 12, padding: "6px 12px", borderColor: "rgba(245,158,11,0.3)", color: "#f59e0b" }}>
                              Revoke
                            </Button>
                          )}
                          <Button variant="ghost" onClick={() => deleteKey(k.id)} style={{ padding: 8, color: "#ef4444" }}>
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "8px 12px", fontFamily: "monospace", fontSize: 13
                      }}>
                        <code style={{ flex: 1, color: "#94a3b8" }}>
                          {showKeyValue[k.id] ? k.key : maskKey(k.key)}
                        </code>
                        <button onClick={() => setShowKeyValue(prev => ({ ...prev, [k.id]: !prev[k.id] }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                          {showKeyValue[k.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button onClick={() => copyToClipboard(k.key)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                          <Copy size={16} />
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 20, marginTop: 12, color: "#64748b", fontSize: 12 }}>
                        <span>Requests: {k.requestCount} / {k.requestLimit}</span>
                        <span>Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                        {k.lastUsedAt && <span>Last used: {new Date(k.lastUsedAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ====== WEBHOOKS ====== */}
          {activeTab === "webhooks" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Receive real-time notifications when events occur</p>
                <Button variant="primary" onClick={() => setShowWebhookModal(true)}>
                  <Plus size={16} style={{ marginRight: 8 }} /> New Webhook
                </Button>
              </div>

              {webhooks.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
                  <Webhook size={48} style={{ margin: "0 auto 16px", opacity: 0.4 }} />
                  <p style={{ fontSize: 18, fontWeight: 500 }}>No webhooks configured</p>
                  <p style={{ fontSize: 14 }}>Add a webhook to receive event notifications</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {webhooks.map(wh => {
                    const events: string[] = JSON.parse(wh.events || "[]");
                    return (
                      <div key={wh.id} style={{
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 14, padding: 20
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Webhook size={18} color="#06b6d4" />
                            <code style={{ fontSize: 14, color: "#e2e8f0", background: "rgba(0,0,0,0.3)", padding: "4px 10px", borderRadius: 6 }}>{wh.url}</code>
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                              background: wh.status === "ACTIVE" ? "rgba(34,197,94,0.15)" : "rgba(107,114,128,0.15)",
                              color: wh.status === "ACTIVE" ? "#22c55e" : "#6b7280"
                            }}>
                              {wh.status}
                            </span>
                          </div>
                          <Button variant="ghost" onClick={() => deleteWebhook(wh.id)} style={{ padding: 8, color: "#ef4444" }}>
                            <Trash2 size={16} />
                          </Button>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {events.map(ev => (
                            <span key={ev} style={{
                              fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 6,
                              background: "rgba(139,92,246,0.1)", color: "#a78bfa"
                            }}>
                              {ev}
                            </span>
                          ))}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, color: "#64748b", fontSize: 12 }}>
                          <Shield size={13} />
                          <span>Secret: {wh.secret.substring(0, 10)}•••</span>
                          <button onClick={() => copyToClipboard(wh.secret)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ====== WORKFLOWS ====== */}
          {activeTab === "workflows" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Automate actions based on events in your pipeline</p>
                <Button variant="primary" onClick={() => setShowWorkflowModal(true)}>
                  <Plus size={16} style={{ marginRight: 8 }} /> New Workflow
                </Button>
              </div>

              {workflows.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
                  <Zap size={48} style={{ margin: "0 auto 16px", opacity: 0.4 }} />
                  <p style={{ fontSize: 18, fontWeight: 500 }}>No automation workflows</p>
                  <p style={{ fontSize: 14 }}>Create rules to automate your content pipeline</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {workflows.map(wf => (
                    <div key={wf.id} style={{
                      background: "rgba(255,255,255,0.03)", border: `1px solid ${wf.status === "ACTIVE" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 14, padding: 20
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Zap size={18} color={wf.status === "ACTIVE" ? "#22c55e" : "#6b7280"} />
                          <h4 style={{ fontSize: 16, fontWeight: 600 }}>{wf.name}</h4>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button onClick={() => toggleWorkflow(wf.id, wf.status)} style={{ background: "none", border: "none", cursor: "pointer", color: wf.status === "ACTIVE" ? "#22c55e" : "#6b7280" }}>
                            {wf.status === "ACTIVE" ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                          </button>
                          <Button variant="ghost" onClick={() => deleteWorkflow(wf.id)} style={{ padding: 8, color: "#ef4444" }}>
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "rgba(59,130,246,0.12)", color: "#60a5fa" }}>
                          Trigger: {wf.trigger}
                        </span>
                        <span style={{ color: "#64748b" }}>→</span>
                        <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>
                          Action: {wf.action}
                        </span>
                      </div>
                      {wf.executions.length > 0 && (
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12, marginTop: 4 }}>
                          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Recent Executions:</p>
                          <div style={{ display: "flex", gap: 6 }}>
                            {wf.executions.map(ex => (
                              <span key={ex.id} style={{
                                fontSize: 11, padding: "3px 8px", borderRadius: 6,
                                background: ex.status === "SUCCESS" ? "rgba(34,197,94,0.1)" : ex.status === "FAILED" ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)",
                                color: ex.status === "SUCCESS" ? "#22c55e" : ex.status === "FAILED" ? "#ef4444" : "#3b82f6",
                                display: "flex", alignItems: "center", gap: 4,
                              }}>
                                {ex.status === "SUCCESS" ? <CheckCircle2 size={11} /> : ex.status === "FAILED" ? <XCircle size={11} /> : <Clock size={11} />}
                                {ex.status}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create API Key Modal */}
      <Modal isOpen={showKeyModal} onClose={() => setShowKeyModal(false)} title="Create API Key">
        <div style={{ padding: 16 }}>
          {createdKey ? (
            <div>
              <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <p style={{ color: "#22c55e", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>✅ API Key Created Successfully!</p>
                <p style={{ color: "#f59e0b", fontSize: 13, marginBottom: 12 }}>⚠️ Copy this key now. You won't be able to see it again.</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: "10px 12px" }}>
                  <code style={{ flex: 1, fontSize: 13, color: "#e2e8f0", wordBreak: "break-all" }}>{createdKey}</code>
                  <button onClick={() => copyToClipboard(createdKey)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8b5cf6" }}>
                    <Copy size={18} />
                  </button>
                </div>
              </div>
              <Button variant="primary" onClick={() => setShowKeyModal(false)} style={{ width: "100%" }}>Done</Button>
            </div>
          ) : (
            <div>
              <Input label="Key Name" placeholder="e.g. Production Key" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} />
              <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <Button variant="ghost" onClick={() => setShowKeyModal(false)}>Cancel</Button>
                <Button variant="primary" onClick={createApiKey} disabled={creatingKey || !newKeyName.trim()}>
                  {creatingKey ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} /> : <Key size={16} style={{ marginRight: 8 }} />}
                  Create Key
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Create Webhook Modal */}
      <Modal isOpen={showWebhookModal} onClose={() => setShowWebhookModal(false)} title="Create Webhook">
        <div style={{ padding: 16 }}>
          <Input label="Endpoint URL" placeholder="https://your-server.com/webhook" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, display: "block" }}>Events to Subscribe</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {WEBHOOK_EVENTS.map(ev => {
                const selected = webhookEvents.includes(ev);
                return (
                  <button key={ev} onClick={() => {
                    setWebhookEvents(prev => selected ? prev.filter(e => e !== ev) : [...prev, ev]);
                  }} style={{
                    padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                    background: selected ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${selected ? "#8b5cf6" : "rgba(255,255,255,0.1)"}`,
                    color: selected ? "#a78bfa" : "#94a3b8",
                  }}>
                    {ev}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <Button variant="ghost" onClick={() => setShowWebhookModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={createWebhook} disabled={creatingWebhook || !webhookUrl.trim() || webhookEvents.length === 0}>
              {creatingWebhook ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} /> : <Webhook size={16} style={{ marginRight: 8 }} />}
              Create Webhook
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Workflow Modal */}
      <Modal isOpen={showWorkflowModal} onClose={() => setShowWorkflowModal(false)} title="Create Automation Rule">
        <div style={{ padding: 16 }}>
          <Input label="Rule Name" placeholder="e.g. Auto-publish on generation" value={wfName} onChange={e => setWfName(e.target.value)} />
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, display: "block" }}>Trigger Event</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {WORKFLOW_TRIGGERS.map(t => (
                <button key={t.value} onClick={() => setWfTrigger(t.value)} style={{
                  padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left",
                  background: wfTrigger === t.value ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${wfTrigger === t.value ? "#3b82f6" : "rgba(255,255,255,0.08)"}`,
                  color: wfTrigger === t.value ? "#60a5fa" : "#94a3b8",
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, display: "block" }}>Action</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {WORKFLOW_ACTIONS.map(a => (
                <button key={a.value} onClick={() => setWfAction(a.value)} style={{
                  padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left",
                  background: wfAction === a.value ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${wfAction === a.value ? "#22c55e" : "rgba(255,255,255,0.08)"}`,
                  color: wfAction === a.value ? "#4ade80" : "#94a3b8",
                }}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <Button variant="ghost" onClick={() => setShowWorkflowModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={createWorkflow} disabled={creatingWorkflow || !wfName.trim() || !wfTrigger || !wfAction}>
              {creatingWorkflow ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} /> : <Zap size={16} style={{ marginRight: 8 }} />}
              Create Rule
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
