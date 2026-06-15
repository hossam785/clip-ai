"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { useRouter } from "next/navigation";
import { 
  Key, ShieldAlert, Sparkles, Coins, Users, Settings, Plus, 
  Trash2, ToggleLeft, ToggleRight, Loader2, ArrowLeft, RefreshCw,
  TrendingUp, Activity, Check, CircleAlert, DollarSign 
} from "lucide-react";

interface GeminiKey {
  id: string;
  key: string;
  status: string;
  requestsCount: number;
  successCount: number;
  failedCount: number;
  consumption: number;
  successRate?: number;
  errorMessage: string | null;
  lastUsed: string | null;
}

interface User {
  id: string;
  email: string;
  role: string;
  credits: number;
  createdAt: string;
}

interface SystemConfig {
  key: string;
  value: string;
}

export default function AdminDashboardPage() {
  const { token, user } = useAuth();
  const { t, isRtl } = useI18n();
  const router = useRouter();

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<"keys" | "users" | "configs">("keys");

  // Keys States
  const [keys, setKeys] = useState<GeminiKey[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [isAddingKey, setIsAddingKey] = useState(false);
  const isSandboxMode = keys.length === 0 || keys.every(k => k.key === 'AIzaSyMockDefaultRotationKey' || k.key.startsWith('AIzaSyMock'));

  // Users States
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [creditAdjustment, setCreditAdjustment] = useState<{ [userId: string]: number }>({});
  const [isUpdatingCredits, setIsUpdatingCredits] = useState<string | null>(null);

  // Configs States
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(true);
  const [configValues, setConfigValues] = useState<{ [key: string]: string }>({});
  const [isSavingConfigs, setIsSavingConfigs] = useState(false);

  useEffect(() => {
    if (!token) return;
    if (activeTab === "keys") fetchKeys();
    if (activeTab === "users") fetchUsers();
    if (activeTab === "configs") fetchConfigs();
  }, [token, activeTab]);

  const fetchKeys = async () => {
    setIsLoadingKeys(true);
    try {
      const res = await fetch("http://localhost:4000/admin/keys", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey) return;
    setIsAddingKey(true);

    try {
      const res = await fetch("http://localhost:4000/admin/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ key: newKey })
      });

      if (res.ok) {
        setNewKey("");
        fetchKeys();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAddingKey(false);
    }
  };

  const handleToggleKey = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`http://localhost:4000/admin/keys/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });

      if (res.ok) {
        setKeys(keys.map(k => k.id === id ? { ...k, status: nextStatus } : k));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm(isRtl ? "هل أنت متأكد من مسح هذا المفتاح البرمجي؟" : "Are you sure you want to delete this API Key?")) return;
    try {
      const res = await fetch(`http://localhost:4000/admin/keys/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setKeys(keys.filter(k => k.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch("http://localhost:4000/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleAdjustCredits = async (userId: string) => {
    const amount = creditAdjustment[userId] || 0;
    if (amount === 0) return;
    setIsUpdatingCredits(userId);

    try {
      const res = await fetch(`http://localhost:4000/admin/users/${userId}/credits`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount })
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(users.map(u => u.id === userId ? { ...u, credits: data.credits } : u));
        setCreditAdjustment({ ...creditAdjustment, [userId]: 0 });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdatingCredits(null);
    }
  };

  const fetchConfigs = async () => {
    setIsLoadingConfigs(true);
    try {
      const res = await fetch("http://localhost:4000/admin/configs", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConfigs(data);
        const valMap: { [key: string]: string } = {};
        data.forEach((c: any) => {
          valMap[c.key] = c.value;
        });
        setConfigValues(valMap);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  const handleSaveConfigs = async () => {
    setIsSavingConfigs(true);
    try {
      for (const [key, value] of Object.entries(configValues)) {
        await fetch(`http://localhost:4000/admin/configs/${key}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ value })
        });
      }
      alert(isRtl ? "تم حفظ إعدادات التسعير بنجاح!" : "Pricing configurations saved successfully!");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingConfigs(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 flex flex-col" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Top Navbar */}
      <header className="h-16 border-b border-white/5 bg-zinc-950/45 px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="h-5 w-5 text-purple-400" />
            <span className="font-extrabold text-sm text-white">{isRtl ? "لوحة الإدارة والمفاتيح" : "Admin API Key Management"}</span>
          </div>
        </div>

        <span className="text-xs text-zinc-500 font-mono">ROLE: {user?.role}</span>
      </header>

      {/* Content Wrapper */}
      <main className="max-w-7xl w-full mx-auto px-6 py-8 flex-1 grid grid-cols-1 md:grid-cols-12 gap-8 z-10">
        
        {/* Navigation Sidebar */}
        <aside className="md:col-span-3 space-y-2">
          <button
            onClick={() => setActiveTab("keys")}
            className={`w-full text-right p-3.5 rounded-2xl border transition-all flex items-center gap-3 font-semibold text-xs ${
              activeTab === "keys" 
                ? 'border-purple-500 bg-purple-500/5 text-white shadow-[0_0_15px_rgba(139,92,246,0.08)]' 
                : 'border-zinc-900 bg-zinc-950/40 text-zinc-400 hover:text-white'
            }`}
          >
            <Key className="h-4 w-4" />
            <span>{isRtl ? "توزيع مفاتيح Gemini" : "Gemini API Keys"}</span>
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`w-full text-right p-3.5 rounded-2xl border transition-all flex items-center gap-3 font-semibold text-xs ${
              activeTab === "users" 
                ? 'border-purple-500 bg-purple-500/5 text-white shadow-[0_0_15px_rgba(139,92,246,0.08)]' 
                : 'border-zinc-900 bg-zinc-950/40 text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>{isRtl ? "إدارة أرصدة المستخدمين" : "User Credits Management"}</span>
          </button>

          <button
            onClick={() => setActiveTab("configs")}
            className={`w-full text-right p-3.5 rounded-2xl border transition-all flex items-center gap-3 font-semibold text-xs ${
              activeTab === "configs" 
                ? 'border-purple-500 bg-purple-500/5 text-white shadow-[0_0_15px_rgba(139,92,246,0.08)]' 
                : 'border-zinc-900 bg-zinc-950/40 text-zinc-400 hover:text-white'
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>{isRtl ? "تسعير واستهلاك العمليات" : "Process Pricing configs"}</span>
          </button>

          <button
            onClick={() => router.push("/admin/revenue")}
            className="w-full text-right p-3.5 rounded-2xl border border-zinc-900 bg-zinc-950/40 text-zinc-450 hover:text-white transition-all flex items-center gap-3 font-semibold text-xs cursor-pointer"
          >
            <Coins className="h-4 w-4 text-purple-400" />
            <span>{isRtl ? "لوحة الإيرادات والأرباح" : "Revenue & Billings"}</span>
          </button>
        </aside>

        {/* Tab Contents */}
        <section className="md:col-span-9 space-y-6">
          
          {/* Tab 1: Keys RotationPool */}
          {activeTab === "keys" && (
            <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6">
              <div className="flex justify-between items-center text-right">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white">{isRtl ? "مجموعة مفاتيح الذكاء الاصطناعي" : "Gemini API Key Pools"}</h2>
                    {isSandboxMode && (
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-[9px] font-bold animate-pulse">
                        {isRtl ? "⚠️ وضع المحاكاة" : "⚠️ Sandbox Mode"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">{isRtl ? "إضافة وتفعيل وتتبع استهلاك ونجاح مفاتيح Gemini تلقائياً" : "Configure auto-failover, load balancing, and character logs"}</p>
                </div>
              </div>

              {/* Add Key Form */}
              <form onSubmit={handleAddKey} className="flex gap-2 text-right">
                <input
                  type="text"
                  required
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder={isRtl ? "أدخل مفتاح Gemini API Key الجديد..." : "AIzaSy..."}
                  className="flex-1 bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-purple-500 transition-colors text-right"
                />
                <button
                  type="submit"
                  disabled={isAddingKey}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(139,92,246,0.15)] flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>{isRtl ? "إضافة" : "Add Key"}</span>
                </button>
              </form>

              {/* Table */}
              <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
                {isLoadingKeys ? (
                  <div className="text-center py-20 text-zinc-500 text-xs flex items-center justify-center gap-2">
                    <Loader2 className="h-4.5 w-4.5 animate-spin text-purple-500" />
                    <span>{t.common.loading}</span>
                  </div>
                ) : keys.length === 0 ? (
                  <div className="text-center py-20 text-xs text-zinc-650">
                    {isRtl ? "لا توجد مفاتيح مسجلة." : "No API Keys registered."}
                  </div>
                ) : (
                  <table className="w-full text-right text-xs">
                    <thead className="bg-zinc-950/60 border-b border-zinc-900 text-zinc-400 font-bold">
                      <tr>
                        <th className="p-4">{isRtl ? "المفتاح البرمجي" : "API Key"}</th>
                        <th className="p-4 text-center">{isRtl ? "الحالة" : "Status"}</th>
                        <th className="p-4 text-center">{isRtl ? "إجمالي الطلبات" : "Requests"}</th>
                        <th className="p-4 text-center">{isRtl ? "نسبة النجاح" : "Success Rate"}</th>
                        <th className="p-4 text-center">{isRtl ? "الاستهلاك (حرف)" : "Usage (Chars)"}</th>
                        <th className="p-4 text-center">{isRtl ? "الإجراءات" : "Actions"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {keys.map((k) => (
                        <tr key={k.id} className="hover:bg-zinc-900/10">
                          <td className="p-4 font-mono font-bold text-zinc-350">
                            {k.key.substring(0, 14)}...
                            {k.errorMessage && (
                              <span className="block text-[8px] text-red-400 mt-1 max-w-[200px] truncate" title={k.errorMessage}>
                                ⚠️ Error: {k.errorMessage}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              k.status === "ACTIVE" ? 'bg-green-500/10 text-green-400 border border-green-500/15' : 'bg-red-500/10 text-red-400 border border-red-500/15'
                            }`}>
                              {k.status}
                            </span>
                          </td>
                          <td className="p-4 text-center font-mono text-zinc-300">{k.requestsCount}</td>
                          <td className="p-4 text-center font-mono font-bold text-zinc-350">{k.successRate}%</td>
                          <td className="p-4 text-center font-mono text-zinc-400">{k.consumption.toLocaleString()}</td>
                          <td className="p-4 text-center flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleToggleKey(k.id, k.status)}
                              className="p-1 text-zinc-500 hover:text-white transition-colors"
                              title="Toggle status"
                            >
                              {k.status === "ACTIVE" ? <ToggleRight className="h-5 w-5 text-purple-500" /> : <ToggleLeft className="h-5 w-5" />}
                            </button>
                            <button
                              onClick={() => handleDeleteKey(k.id)}
                              className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                              title="Delete Key"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Users Credit Wallet Management */}
          {activeTab === "users" && (
            <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6">
              <div className="space-y-1 text-right">
                <h2 className="text-lg font-black text-white">{isRtl ? "إدارة أرصدة ومحافظ المستخدمين" : "User Credits & Wallet Manager"}</h2>
                <p className="text-xs text-zinc-500">{isRtl ? "منح أرصدة إضافية للمستخدمين أو خصمها يدوياً" : "View users list and adjust credit balances"}</p>
              </div>

              <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/20">
                {isLoadingUsers ? (
                  <div className="text-center py-20 text-zinc-500 text-xs flex items-center justify-center gap-2">
                    <Loader2 className="h-4.5 w-4.5 animate-spin text-purple-500" />
                    <span>{t.common.loading}</span>
                  </div>
                ) : (
                  <table className="w-full text-right text-xs">
                    <thead className="bg-zinc-950/60 border-b border-zinc-900 text-zinc-400 font-bold">
                      <tr>
                        <th className="p-4">{isRtl ? "البريد الإلكتروني" : "User Email"}</th>
                        <th className="p-4 text-center">{isRtl ? "الصلاحية" : "Role"}</th>
                        <th className="p-4 text-center">{isRtl ? "الرصيد الحالي" : "Credits"}</th>
                        <th className="p-4 text-center">{isRtl ? "تعديل الرصيد" : "Adjust Credits"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-zinc-900/10">
                          <td className="p-4 font-bold text-zinc-300">{u.email}</td>
                          <td className="p-4 text-center font-bold text-zinc-450">{u.role}</td>
                          <td className="p-4 text-center font-mono font-bold text-purple-300">{u.credits}</td>
                          <td className="p-4 text-center flex items-center justify-center gap-2">
                            <input
                              type="number"
                              value={creditAdjustment[u.id] || ""}
                              onChange={(e) => setCreditAdjustment({ ...creditAdjustment, [u.id]: parseInt(e.target.value, 10) })}
                              placeholder={isRtl ? "مثال: 50" : "+/- Amount"}
                              className="w-24 bg-zinc-950 border border-zinc-900 rounded-xl px-2.5 py-1.5 text-center text-xs font-mono placeholder-zinc-700 focus:outline-none"
                            />
                            <button
                              onClick={() => handleAdjustCredits(u.id)}
                              disabled={isUpdatingCredits === u.id}
                              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all shadow-[0_0_10px_rgba(139,92,246,0.1)] flex items-center gap-1"
                            >
                              {isUpdatingCredits === u.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              <span>{isRtl ? "تحديث" : "Apply"}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: SystemConfig Costs Settings */}
          {activeTab === "configs" && (
            <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6">
              <div className="space-y-1 text-right">
                <h2 className="text-lg font-black text-white">{isRtl ? "إعدادات تكاليف واستهلاك العمليات" : "Process Pricing & System Cost Builder"}</h2>
                <p className="text-xs text-zinc-500">{isRtl ? "تحديد كمية Credits المستهلكة لكل كليب أو تحويل" : "Configure credit charges applied per operation stage"}</p>
              </div>

              {isLoadingConfigs ? (
                <div className="text-center py-20 text-zinc-500 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="h-4.5 w-4.5 animate-spin text-purple-500" />
                  <span>{t.common.loading}</span>
                </div>
              ) : (
                <div className="space-y-5">
                  {configs.map((c) => (
                    <div key={c.key} className="flex justify-between items-center text-right p-4 border border-zinc-900 bg-zinc-950/20 rounded-2xl gap-6">
                      <input
                        type="number"
                        value={configValues[c.key] || ""}
                        onChange={(e) => setConfigValues({ ...configValues, [c.key]: e.target.value })}
                        className="bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-2.5 text-center text-xs font-mono text-purple-300 font-bold focus:outline-none"
                      />
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-white block">
                          {c.key === 'price_per_clip' ? (isRtl ? "تكلفة الكليب الواحد (وضع AI):" : "Price Per Auto Clip:") :
                           c.key === 'price_custom_range' ? (isRtl ? "تكلفة تقطيع الفترة اليدوية الواحد:" : "Price Per Manual Crop Range:") :
                           c.key === 'price_effects' ? (isRtl ? "تكلفة تفعيل المؤثرات والانتقالات:" : "Price for Subtitle Transitions & Sound Effects:") :
                           c.key}
                        </label>
                        <span className="text-[10px] text-zinc-500 leading-tight block">
                          {c.key === 'price_per_clip' ? (isRtl ? "الأرصدة المخصومة لكل كليب يكتشفه الذكاء الاصطناعي تلقائياً" : "Credits deducted per single video clip extracted in AI mode") :
                           c.key === 'price_custom_range' ? (isRtl ? "الأرصدة المخصومة لكل كليب يحدده المستخدم يدوياً" : "Credits charged per single manual crop time block specify") :
                           c.key === 'price_effects' ? (isRtl ? "الأرصدة الإضافية المخصومة لتطبيق الانتقالات والمؤثرات الصوتية" : "Credits charged when styling subtitles animations & transitions") : ""}
                        </span>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleSaveConfigs}
                    disabled={isSavingConfigs}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-xl py-3.5 text-xs font-bold transition-all shadow-[0_0_15px_rgba(139,92,246,0.15)] flex items-center justify-center gap-1.5"
                  >
                    {isSavingConfigs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    <span>{isRtl ? "حفظ التغييرات" : "Save Configurations"}</span>
                  </button>
                </div>
              )}
            </div>
          )}

        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-zinc-600">
        <p>© 2026 {t.common.appName}. All rights reserved.</p>
      </footer>
    </div>
  );
}
