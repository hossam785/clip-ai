"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  BarChart3, Coins, Users, CreditCard, Loader2, ArrowLeft, ArrowRight,
  TrendingUp, Award, DollarSign, Percent, ShieldCheck, ShoppingCart, Calendar
} from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/Table";
import { useToast } from "../../../components/ui/Toast";

interface Customer {
  id: string;
  email: string;
  credits: number;
  lifetimeCreditsUsed: number;
}

interface PlanInfo {
  name: string;
  count: number;
  revenue: number;
}

interface Payment {
  id: string;
  stripeSessionId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  user: {
    email: string;
  };
}

export default function AdminRevenuePage() {
  const { token, user } = useAuth();
  const { t, isRtl } = useI18n();
  const router = useRouter();
  const { success, error, info } = useToast();

  // State
  const [revenueData, setRevenueData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Basic route guard
    if (!token) {
      router.push("/login");
      return;
    }
    if (user && user.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetchRevenueStats();
  }, [token, user]);

  const fetchRevenueStats = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:4000/admin/revenue", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRevenueData(data);
      } else {
        error(isRtl ? "فشل جلب إحصائيات الإيرادات" : "Failed to load revenue metrics");
      }
    } catch (err) {
      console.error(err);
      error(isRtl ? "حدث خطأ أثناء الاتصال بالخادم" : "Server communication error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070709] text-zinc-150 flex items-center justify-center">
        <div className="flex items-center gap-3 bg-zinc-950/60 border border-zinc-900 px-6 py-4 rounded-3xl backdrop-blur-xl">
          <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
          <span className="text-xs font-bold font-mono tracking-wider">{t.common.loading}</span>
        </div>
      </div>
    );
  }

  // Fallback defaults
  const mrr = revenueData?.mrr ?? 0;
  const arr = revenueData?.arr ?? 0;
  const churnRate = revenueData?.churnRate ?? 0;
  const totalRevenue = revenueData?.totalRevenue ?? 0;
  const activeSubs = revenueData?.activeSubscriptions ?? 0;
  const planDistribution: PlanInfo[] = revenueData?.planDistribution ?? [];
  const topCustomers: Customer[] = revenueData?.topCustomers ?? [];
  const recentPayments: Payment[] = revenueData?.recentPayments ?? [];

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 flex flex-col" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Top Navbar */}
      <header className="h-16 border-b border-white/5 bg-zinc-950/40 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
            {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            <span className="text-xs font-bold">{isRtl ? "الرجوع للوحة المفاتيح" : "Back to Keys Panel"}</span>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-purple-400" />
            <span className="font-extrabold text-sm text-white">{isRtl ? "لوحة التحليلات المالية والأرباح" : "Revenue & Billings Analytics"}</span>
          </div>
        </div>

        <span className="text-xs text-zinc-500 font-mono">ADMIN ACCESS</span>
      </header>

      <main className="max-w-6xl w-full mx-auto px-6 py-10 flex-1 space-y-8 z-10 text-right rtl:text-right ltr:text-left">
        
        {/* Core financial cards grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-950/45 border border-white/5 p-5 rounded-3xl space-y-2 shadow-md">
            <div className="flex justify-between items-center">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{isRtl ? "الإيرادات الشهرية (MRR)" : "Monthly Recur (MRR)"}</span>
            </div>
            <p className="text-2xl font-black font-mono text-white">${mrr.toLocaleString()}</p>
          </div>

          <div className="bg-zinc-950/45 border border-white/5 p-5 rounded-3xl space-y-2 shadow-md">
            <div className="flex justify-between items-center">
              <TrendingUp className="h-4 w-4 text-purple-400 animate-pulse" />
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{isRtl ? "الإيرادات السنوية (ARR)" : "Annual Recur (ARR)"}</span>
            </div>
            <p className="text-2xl font-black font-mono text-purple-300">${arr.toLocaleString()}</p>
          </div>

          <div className="bg-zinc-950/45 border border-white/5 p-5 rounded-3xl space-y-2 shadow-md">
            <div className="flex justify-between items-center">
              <Percent className="h-4 w-4 text-red-400" />
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{isRtl ? "معدل الإلغاء (Churn)" : "Churn Rate"}</span>
            </div>
            <p className="text-2xl font-black font-mono text-white">{churnRate}%</p>
          </div>

          <div className="bg-zinc-950/45 border border-white/5 p-5 rounded-3xl space-y-2 shadow-md">
            <div className="flex justify-between items-center">
              <DollarSign className="h-4 w-4 text-green-400" />
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{isRtl ? "إجمالي المدفوعات" : "Total Gross Revenue"}</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-400">${totalRevenue.toLocaleString()}</p>
          </div>
        </section>

        {/* Subscription plan distribution details */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          
          <div className="md:col-span-7 bg-[#0b0b0f] border border-white/5 p-6 rounded-3xl flex flex-col justify-between space-y-6 shadow-xl">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-white">{isRtl ? "توزيع الاشتراكات والخطط" : "Subscription Plan Distribution"}</h3>
              <p className="text-[10px] text-zinc-500">{isRtl ? "مخطط لمبيعات الخطط الخمس وعدد العملاء النشطين" : "Active customer counts across standard billing tiers"}</p>
            </div>

            <div className="space-y-4">
              {planDistribution.map((plan) => {
                const maxCount = Math.max(...planDistribution.map(p => p.count), 1);
                const percent = Math.round((plan.count / maxCount) * 100);
                
                return (
                  <div key={plan.name} className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-zinc-300 font-mono font-extrabold">{plan.name}</span>
                      <span className="text-zinc-400">
                        {plan.count} {isRtl ? "عملاء" : "users"} • <strong className="text-green-400 font-mono">${plan.revenue}</strong>
                      </span>
                    </div>

                    <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-900">
                      <div 
                        style={{ width: `${percent}%` }} 
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" 
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center text-[10px] font-mono text-zinc-550 border-t border-zinc-900/60 pt-4">
              <span>{isRtl ? `إجمالي الاشتراكات النشطة: ` : `Total Active Subscribers: `} <strong>{activeSubs}</strong></span>
              <span>{isRtl ? `أكواد الإحالة المستخدمة: ` : `Total Successful Referrals: `} <strong>{revenueData?.referralsCount ?? 0}</strong></span>
            </div>
          </div>

          {/* Top Customers Panel */}
          <div className="md:col-span-5 bg-zinc-950/45 border border-zinc-900 p-6 rounded-3xl flex flex-col justify-between space-y-4 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Award className="h-4.5 w-4.5 text-purple-400" />
                <h3 className="text-sm font-black text-white">{isRtl ? "العملاء الأكثر استهلاكاً للأرصدة" : "Top Credits Consumers"}</h3>
              </div>
              <p className="text-[10px] text-zinc-500">{isRtl ? "ترتيب العملاء تنازلياً حسب إجمالي استهلاك الأرصدة التراكمي" : "Active users ranked by lifetime processing usage"}</p>
            </div>

            {topCustomers.length === 0 ? (
              <div className="text-center py-12 text-xs text-zinc-600 font-mono">
                {isRtl ? "لا توجد سجلات مستخدمين نشطة" : "No user consumption logs"}
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {topCustomers.map((cust) => (
                  <div key={cust.id} className="p-3 bg-zinc-950 border border-zinc-900 rounded-2xl flex justify-between items-center text-xs">
                    <div className="space-y-0.5 text-right flex-1 min-w-0 pr-3">
                      <span className="font-bold text-zinc-350 block truncate">{cust.email}</span>
                      <span className="text-[9px] text-zinc-550 block font-mono">CREDITS LEFT: {cust.credits}</span>
                    </div>

                    <div className="text-right flex-shrink-0 font-mono text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/15 py-1 px-2.5 rounded-lg">
                      <strong>{cust.lifetimeCreditsUsed.toLocaleString()}</strong> {isRtl ? "مستهلك" : "used"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Recent Stripe Payments list */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-900 pb-2">
            <ShoppingCart className="h-4.5 w-4.5 text-purple-400" />
            <h3 className="text-base font-black text-white">{isRtl ? "سجل المعاملات والمدفوعات الأخيرة" : "Recent Gross Stripe Payments"}</h3>
          </div>

          {recentPayments.length === 0 ? (
            <div className="text-center py-14 border border-zinc-900 border-dashed rounded-3xl text-xs text-zinc-500 font-semibold font-mono">
              {isRtl ? "لا توجد معاملات شراء نشطة مسجلة بعد." : "No successful billing transactions recorded yet."}
            </div>
          ) : (
            <div className="bg-zinc-950/20 border border-zinc-900 rounded-3xl overflow-hidden shadow-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">{isRtl ? "المستخدم" : "User Customer"}</TableHead>
                    <TableHead className="text-center">{isRtl ? "معرف المعاملة" : "Session ID"}</TableHead>
                    <TableHead className="text-center">{isRtl ? "القيمة" : "Gross Amount"}</TableHead>
                    <TableHead className="text-center">{isRtl ? "الحالة" : "Payment Status"}</TableHead>
                    <TableHead className="text-center">{isRtl ? "التاريخ" : "Timestamp"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((pay) => (
                    <TableRow key={pay.id}>
                      <TableCell className="text-zinc-200 font-bold text-xs text-right">{pay.user?.email}</TableCell>
                      <TableCell className="text-center text-[10px] font-mono text-zinc-500 truncate max-w-[150px]">{pay.stripeSessionId}</TableCell>
                      <TableCell className="text-center font-mono font-black text-green-400 text-xs">${pay.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                          pay.status === "COMPLETED"
                            ? "bg-green-500/10 text-green-400 border-green-500/15"
                            : "bg-zinc-800 text-zinc-400 border-zinc-900"
                        }`}>
                          {pay.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-[10px] font-mono text-zinc-550">
                        {new Date(pay.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
