"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  CreditCard, Coins, Check, Loader2, ArrowLeft, ArrowRight,
  ShieldCheck, HelpCircle, AlertCircle, ShoppingBag, Receipt, History
} from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/Table";
import { useToast } from "../../../components/ui/Toast";

// Separated component to use SearchParams in Next.js 15 Suspense boundaries
function BillingContent() {
  const { user, token, refreshUser } = useAuth();
  const { t, isRtl } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error, info } = useToast();

  // State
  const [balanceDetails, setBalanceDetails] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [isLoading, setIsLoading] = useState(true);
  
  // Checkout & Simulation states
  const [isCheckoutLoading, setIsCheckoutLoading] = useState<string | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<{ sessionId: string; plan?: string; credits?: number; interval?: string } | null>(null);
  const [isFulfilling, setIsFulfilling] = useState(false);

  // Read URL search params for sandbox simulation trigger
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const plan = searchParams.get("plan");
    const credits = searchParams.get("credits");
    const interval = searchParams.get("interval");

    if (sessionId) {
      setCheckoutSession({
        sessionId,
        plan: plan || undefined,
        credits: credits ? parseInt(credits, 10) : undefined,
        interval: interval || undefined
      });
      info(isRtl ? "تم تحميل بوابة الدفع التخيلية بنجاح." : "Simulation checkout loaded successfully.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
    fetchBillingData();
  }, [token]);

  const fetchBillingData = async () => {
    setIsLoading(true);
    try {
      const [balanceRes, txRes, plansRes] = await Promise.all([
        fetch("http://localhost:4000/billing/balance", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("http://localhost:4000/billing/transactions", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("http://localhost:4000/billing/plans")
      ]);

      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        setBalanceDetails(balanceData);
      }
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData);
      }
      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData);
      }
    } catch (err) {
      console.error(err);
      error(isRtl ? "فشل جلب بيانات الدفع والاشتراكات" : "Failed to load billing metrics");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (planName: string) => {
    setIsCheckoutLoading(planName);
    try {
      const res = await fetch("http://localhost:4000/billing/checkout-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planName: planName.toUpperCase(),
          interval: billingInterval
        })
      });

      if (!res.ok) {
        throw new Error("Checkout failed");
      }

      const data = await res.json();
      if (data.url) {
        // Redirection to either real Stripe Checkout or our mock URL
        window.location.href = data.url;
      } else {
        error(isRtl ? "فشل الحصول على رابط الدفع" : "Failed to retrieve payment link");
      }
    } catch (err) {
      console.error(err);
      error(isRtl ? "حدث خطأ أثناء الاتصال ببوابة الدفع" : "Payment gateway error occurred");
    } finally {
      setIsCheckoutLoading(null);
    }
  };

  const handleBuyCredits = async (amount: number) => {
    const loaderId = `credits_${amount}`;
    setIsCheckoutLoading(loaderId);
    try {
      const res = await fetch("http://localhost:4000/billing/checkout-credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount })
      });

      if (!res.ok) {
        throw new Error("Checkout failed");
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        error(isRtl ? "فشل الحصول على رابط الشحن" : "Failed to retrieve refill link");
      }
    } catch (err) {
      console.error(err);
      error(isRtl ? "حدث خطأ أثناء الاتصال ببوابة الشحن" : "Payment gateway error occurred");
    } finally {
      setIsCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setIsCheckoutLoading("portal");
    try {
      const res = await fetch("http://localhost:4000/billing/customer-portal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } else {
        info(isRtl ? "وضع محاكاة: لا توجد حاجة للتحويل لبوابة Stripe" : "Simulation: Stripe billing portal not needed");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCheckoutLoading(null);
    }
  };

  const handleConfirmSimulation = async () => {
    if (!checkoutSession) return;
    setIsFulfilling(true);
    try {
      const res = await fetch("http://localhost:4000/billing/checkout-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId: checkoutSession.sessionId })
      });

      if (res.ok) {
        success(isRtl ? "تمت عملية الدفع المحاكاة بنجاح وترقية الحساب!" : "Simulated payment succeeded, account updated!");
        setCheckoutSession(null);
        // Clean URL params
        router.push("/dashboard/billing");
        refreshUser();
        fetchBillingData();
      } else {
        error(isRtl ? "فشل تأكيد عملية الدفع المحاكاة" : "Failed to fulfill mock payment session");
      }
    } catch (err) {
      console.error(err);
      error(isRtl ? "حدث خطأ أثناء تأكيد العملية" : "Error occurred during simulation fulfillment");
    } finally {
      setIsFulfilling(false);
    }
  };

  // Helper translations helper
  const translatePlan = (plan: string) => {
    const mapped: Record<string, string> = {
      FREE: isRtl ? "الباقة المجانية" : "Free Plan",
      STARTER: isRtl ? "الباقة المبتدئة" : "Starter Plan",
      PRO: isRtl ? "الباقة الاحترافية" : "Pro Plan",
      BUSINESS: isRtl ? "باقة الأعمال" : "Business Plan",
      ENTERPRISE: isRtl ? "باقة الشركات" : "Enterprise Plan"
    };
    return mapped[plan.toUpperCase()] || plan;
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

  const activePlanName = balanceDetails?.subscription?.plan || "FREE";

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 flex flex-col" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Simulation checkout modal */}
      {checkoutSession && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b0b0f] border border-purple-500/20 max-w-md w-full p-6 rounded-3xl space-y-6 text-center shadow-[0_0_50px_rgba(139,92,246,0.15)] relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-purple-500 to-indigo-500" />
            
            <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto border border-purple-500/20">
              <ShoppingBag className="h-7 w-7 text-purple-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">{isRtl ? "محاكي بوابة دفع Stripe" : "Stripe Simulated Checkout"}</h3>
              <p className="text-xs text-zinc-500">
                {isRtl 
                  ? "أنت في وضع الدفع التجريبي المحلي. لا يلزم إدخال بطاقات حقيقية لتفعيل اشتراكك." 
                  : "You are currently running in local simulator mode. No real cards required."}
              </p>
            </div>

            {/* Session details */}
            <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 text-right space-y-2 text-xs font-mono text-zinc-400">
              <div className="flex justify-between items-center border-b border-zinc-900/60 pb-2">
                <span>{isRtl ? "الرقم التعريفي للجلسة:" : "Session ID:"}</span>
                <span className="text-[10px] text-zinc-500 truncate max-w-[180px]">{checkoutSession.sessionId}</span>
              </div>
              {checkoutSession.plan && (
                <div className="flex justify-between items-center">
                  <span>{isRtl ? "الباقة المستهدفة:" : "Target Plan:"}</span>
                  <span className="text-purple-400 font-bold">{translatePlan(checkoutSession.plan)}</span>
                </div>
              )}
              {checkoutSession.interval && (
                <div className="flex justify-between items-center">
                  <span>{isRtl ? "دورة الفوترة:" : "Billing Interval:"}</span>
                  <span className="text-zinc-350">{checkoutSession.interval === "yearly" ? (isRtl ? "سنوي" : "Yearly") : (isRtl ? "شهري" : "Monthly")}</span>
                </div>
              )}
              {checkoutSession.credits && (
                <div className="flex justify-between items-center">
                  <span>{isRtl ? "كمية الرصيد:" : "Credits Count:"}</span>
                  <span className="text-amber-400 font-bold">{checkoutSession.credits} {isRtl ? "رصيد" : "Credits"}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCheckoutSession(null);
                  router.push("/dashboard/billing");
                }}
                className="w-1/3 text-xs"
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                variant="brand"
                onClick={handleConfirmSimulation}
                isLoading={isFulfilling}
                className="flex-1 text-xs"
              >
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                <span>{isRtl ? "إتمام الدفع التخيلي" : "Fulfill Checkout Mock"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <header className="h-16 border-b border-white/5 bg-zinc-950/40 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
            {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            <span className="text-xs font-bold">{isRtl ? "الرئيسية" : "Dashboard"}</span>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-purple-400" />
            <span className="font-extrabold text-sm text-white">{isRtl ? "الاشتراكات والرصيد" : "Subscriptions & Billings"}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl">
            <Coins className="h-4 w-4 text-purple-400" />
            <span className="font-mono text-purple-300 font-extrabold text-xs">{balanceDetails?.credits ?? user?.credits ?? 0}</span>
            <span className="text-[10px] text-zinc-500">{isRtl ? "رصيد" : "Credits"}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto px-6 py-10 flex-1 space-y-10 z-10 text-right rtl:text-right ltr:text-left">
        
        {/* Wallet Balance & Plan card */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          <div className="md:col-span-5 bg-gradient-to-br from-zinc-950 to-zinc-950/60 border border-zinc-900 p-6 rounded-3xl flex flex-col justify-between space-y-4 shadow-xl">
            <div className="space-y-1">
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider block">{isRtl ? "محفظة الأرصدة النشطة" : "Active Credits Wallet"}</span>
              <div className="flex items-baseline gap-2 pt-2">
                <span className="text-4xl font-black font-mono text-purple-300">{balanceDetails?.credits ?? user?.credits ?? 0}</span>
                <span className="text-xs text-zinc-500">{isRtl ? "رصيد متبقي" : "Remaining Credits"}</span>
              </div>
            </div>

            <div className="bg-zinc-900/40 p-4 border border-zinc-900 rounded-2xl text-[10px] text-zinc-400 leading-relaxed font-mono space-y-1">
              <div className="flex justify-between">
                <span>{isRtl ? "أرصدة الباقة الشهرية:" : "Monthly Package Credits:"}</span>
                <span className="text-zinc-300">{balanceDetails?.monthlyCredits ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>{isRtl ? "أرصدة إضافية ترويجية:" : "Bonus Referral Credits:"}</span>
                <span className="text-zinc-300">{balanceDetails?.bonusCredits ?? 0}</span>
              </div>
            </div>

            <p className="text-[10px] text-zinc-650">
              * {isRtl ? "يتم استهلاك رصيدك بمقدار 10 أرصدة لكل كليب يتم تقطيعه أو معالجة صوته." : "Each generated AI clip consumes 10 credits from your wallet."}
            </p>
          </div>

          <div className="md:col-span-7 bg-[#0b0b0f] border border-white/5 p-6 rounded-3xl flex flex-col justify-between space-y-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex justify-between items-start">
              <div className="space-y-1.5">
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider block">{isRtl ? "حالة الاشتراك" : "Subscription Status"}</span>
                <h3 className="text-xl font-black text-white">{translatePlan(activePlanName)}</h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                balanceDetails?.subscription?.status === "ACTIVE" 
                  ? "bg-green-500/10 text-green-400 border-green-500/15" 
                  : "bg-zinc-800 text-zinc-400 border-zinc-800"
              }`}>
                {balanceDetails?.subscription?.status || "INACTIVE"}
              </span>
            </div>

            {/* Plan limits detail progress */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2">
              <div className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl space-y-1 text-center">
                <span className="text-[9px] text-zinc-500 block font-bold">{isRtl ? "حجم الرفع الأقصى" : "Max Upload"}</span>
                <span className="text-xs font-mono font-extrabold text-zinc-300">{balanceDetails?.limits?.maxUploadMb ? `${balanceDetails.limits.maxUploadMb} MB` : "50 MB"}</span>
              </div>
              <div className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl space-y-1 text-center">
                <span className="text-[9px] text-zinc-500 block font-bold">{isRtl ? "سعة التخزين" : "Storage Limit"}</span>
                <span className="text-xs font-mono font-extrabold text-zinc-300">{balanceDetails?.limits?.storageGb ? `${balanceDetails.limits.storageGb} GB` : "0.5 GB"}</span>
              </div>
              <div className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl space-y-1 text-center">
                <span className="text-[9px] text-zinc-500 block font-bold">{isRtl ? "السرعة والأولوية" : "Priority"}</span>
                <span className="text-xs font-mono font-extrabold text-zinc-300">{balanceDetails?.limits?.priority === "HIGH" ? (isRtl ? "قصوى" : "High") : (isRtl ? "عادية" : "Normal")}</span>
              </div>
              <div className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl space-y-1 text-center">
                <span className="text-[9px] text-zinc-500 block font-bold">{isRtl ? "أعضاء الفريق" : "Team Members"}</span>
                <span className="text-xs font-mono font-extrabold text-zinc-300">{balanceDetails?.limits?.maxTeamMembers ?? 1}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-t border-zinc-900/60 pt-4">
              <span className="text-[10px] text-zinc-500">
                {activePlanName !== "FREE" 
                  ? (isRtl ? `تاريخ التجديد التلقائي القادم: ` : `Next renewal date: `) 
                  : (isRtl ? `اشترك في إحدى باقاتنا الاحترافية لفتح كافة إمكانيات الذكاء الاصطناعي.` : `Upgrade to premium plans to unlock full AI pipelines.`)}
                {balanceDetails?.subscription?.currentPeriodEnd && (
                  <strong className="text-zinc-350 font-mono font-bold block sm:inline-block mt-1 sm:mt-0 sm:ml-1">
                    {new Date(balanceDetails.subscription.currentPeriodEnd).toLocaleDateString()}
                  </strong>
                )}
              </span>

              {activePlanName !== "FREE" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isCheckoutLoading === "portal"}
                  onClick={handleManageSubscription}
                  className="text-xs"
                >
                  {isCheckoutLoading === "portal" && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  <Receipt className="h-3.5 w-3.5 mr-1" />
                  <span>{isRtl ? "إدارة اشتراكي والفواتير" : "Manage Billing Details"}</span>
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Available Plans Section */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-zinc-900 pb-4">
            <div className="space-y-1 text-right">
              <h3 className="text-lg font-black text-white">{isRtl ? "باقات واشتراكات المنصة" : "Pricing Subscriptions Plans"}</h3>
              <p className="text-xs text-zinc-500">{isRtl ? "اختر الخطة المناسبة لحجم ونشاط أعمالك" : "Choose the plan optimized for your podcast volume"}</p>
            </div>

            {/* Monthly / Yearly Billing Toggle button */}
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-900 font-bold text-xs">
              <button
                onClick={() => setBillingInterval("monthly")}
                className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                  billingInterval === "monthly" ? "bg-purple-500/15 text-purple-400 border border-purple-500/10 shadow" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {isRtl ? "شهرياً" : "Monthly"}
              </button>
              <button
                onClick={() => setBillingInterval("yearly")}
                className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  billingInterval === "yearly" ? "bg-purple-500/15 text-purple-400 border border-purple-500/10 shadow" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span>{isRtl ? "سنوياً" : "Yearly"}</span>
                <span className="text-[9px] bg-green-500/10 text-green-400 border border-green-500/15 px-1 py-0.5 rounded uppercase">{isRtl ? "وفر 20%" : "Save 20%"}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {plans.map((plan) => {
              const matchesActive = activePlanName === plan.name.toUpperCase();
              const features = plan.features ? (Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features)) : [];
              const price = billingInterval === "yearly" ? Math.round(plan.price * 0.8) : plan.price; // simulate discount on display

              return (
                <div key={plan.id} className={`p-5 rounded-3xl border flex flex-col justify-between gap-5 transition-all relative overflow-hidden ${
                  matchesActive 
                    ? "border-purple-500 bg-purple-500/5 shadow-[0_0_20px_rgba(139,92,246,0.08)]" 
                    : "border-zinc-900 bg-zinc-950/20 hover:bg-zinc-950/40"
                }`}>
                  {matchesActive && (
                    <div className="absolute top-0 right-0 bg-purple-500 text-white font-extrabold text-[8px] uppercase px-3 py-1 rounded-bl-xl">
                      {isRtl ? "نشط" : "Active"}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-extrabold text-sm text-white">{translatePlan(plan.name)}</h4>
                      <p className="text-[9px] text-zinc-500 pt-1 line-clamp-2">{isRtl ? `مناسبة للمشاريع الكبيرة والتقطيع التلقائي` : `Best for scaling video output`}</p>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white">${price}</span>
                      <span className="text-[10px] text-zinc-500">/ {billingInterval === "yearly" ? (isRtl ? "سنوياً" : "year") : (isRtl ? "شهرياً" : "month")}</span>
                    </div>

                    <div className="space-y-1 font-mono text-[9px] text-purple-300 font-extrabold bg-purple-500/5 border border-purple-500/10 p-2.5 rounded-xl text-center">
                      <span>+{plan.credits} {isRtl ? "رصيد محفظة شهري" : "credits per month"}</span>
                    </div>

                    <ul className="space-y-2 border-t border-zinc-900 pt-4">
                      {features.map((f: string, i: number) => (
                        <li key={i} className="text-[10px] text-zinc-400 flex items-start gap-2 justify-start rtl:justify-end">
                          <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    variant={matchesActive ? "outline" : "primary"}
                    size="sm"
                    disabled={matchesActive || isCheckoutLoading !== null}
                    onClick={() => handleSubscribe(plan.name)}
                    className="w-full text-xs font-bold py-2 mt-4"
                  >
                    {isCheckoutLoading === plan.name ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : matchesActive ? (
                      isRtl ? "الخطة الحالية" : "Current Plan"
                    ) : (
                      isRtl ? "ترقية الخطة" : "Upgrade Plan"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Refill credits Section */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-[#070709] border border-zinc-900 p-6 rounded-3xl">
          <div className="md:col-span-5 space-y-2">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-400" />
              <h3 className="text-base font-black text-white">{isRtl ? "شراء أرصدة إضافية منفصلة" : "One-time Credits Refill"}</h3>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {isRtl 
                ? "إذا أوشكت أرصدتك الشهرية على النفاد، يمكنك شحن محفظتك بأرصدة إضافية فورية لا تنتهي بانتهاء الشهر وصالحة مدى الحياة." 
                : "Need more processing power? Buy lifetime credit packages that roll over month-to-month without expiring."}
            </p>
          </div>

          <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { amount: 100, price: 5, label: "Starter Refill" },
              { amount: 500, price: 20, label: "Popular Pack" },
              { amount: 1000, price: 35, label: "Creator Power" }
            ].map((pack) => {
              const loaderId = `credits_${pack.amount}`;
              return (
                <div key={pack.amount} className="p-4 bg-zinc-950 border border-zinc-900 rounded-2xl flex flex-col justify-between items-center text-center space-y-4 hover:border-purple-500/30 transition-all">
                  <div className="space-y-1">
                    <span className="text-zinc-200 text-xs font-black font-mono block">+{pack.amount} {isRtl ? "رصيد" : "Credits"}</span>
                    <span className="text-[10px] text-zinc-500">{pack.label}</span>
                  </div>
                  <span className="text-lg font-black text-purple-300 font-mono">${pack.price}</span>
                  
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isCheckoutLoading !== null}
                    onClick={() => handleBuyCredits(pack.amount)}
                    className="w-full text-[10px] font-bold py-1.5"
                  >
                    {isCheckoutLoading === loaderId ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      isRtl ? "شراء الرصيد" : "Buy Credits"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Transaction History Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-900 pb-2">
            <History className="h-4 w-4 text-purple-400" />
            <h3 className="text-base font-black text-white">{isRtl ? "سجل معاملات المحفظة والخصومات" : "Wallet Transactions History"}</h3>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-12 border border-zinc-900 border-dashed rounded-3xl text-xs text-zinc-500 font-semibold font-mono">
              {isRtl ? "لا توجد معاملات مسجلة للمحفظة حتى الآن." : "No wallet credit transactions logged yet."}
            </div>
          ) : (
            <div className="bg-zinc-950/20 border border-zinc-900 rounded-3xl overflow-hidden shadow-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">{isRtl ? "العملية والوصف" : "Details"}</TableHead>
                    <TableHead className="text-center">{isRtl ? "نوع المعاملة" : "Transaction Type"}</TableHead>
                    <TableHead className="text-center">{isRtl ? "مقدار التغير" : "Amount"}</TableHead>
                    <TableHead className="text-center">{isRtl ? "التاريخ" : "Timestamp"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-zinc-300 text-xs font-semibold text-right">{tx.description}</TableCell>
                      <TableCell className="text-center">
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                          tx.type === "SIGNUP_BONUS" ? "bg-green-500/10 text-green-400 border-green-500/15" :
                          tx.type === "PURCHASE" ? "bg-purple-500/10 text-purple-400 border-purple-500/15" :
                          tx.type === "CLIP_GENERATION" ? "bg-amber-500/10 text-amber-400 border-amber-500/15" :
                          "bg-zinc-900 text-zinc-400 border-zinc-900"
                        }`}>
                          {tx.type}
                        </span>
                      </TableCell>
                      <TableCell className={`text-center font-mono font-extrabold text-xs ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                      </TableCell>
                      <TableCell className="text-center text-[10px] font-mono text-zinc-550">
                        {new Date(tx.createdAt).toLocaleString()}
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

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#070709] text-zinc-150 flex items-center justify-center">
        <div className="flex items-center gap-3 bg-zinc-950/60 border border-zinc-900 px-6 py-4 rounded-3xl backdrop-blur-xl animate-pulse">
          <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
          <span className="text-xs font-bold font-mono tracking-wider">Loading system...</span>
        </div>
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
