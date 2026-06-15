"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Gift, Copy, Sparkles, Check, Loader2, ArrowLeft, ArrowRight,
  Award, Heart, Share2, Ticket, Users2
} from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useToast } from "../../../components/ui/Toast";

interface Referral {
  id: string;
  email: string;
  createdAt: string;
  creditsEarned: number;
}

export default function ReferralsPage() {
  const { token, user, refreshUser } = useAuth();
  const { t, isRtl } = useI18n();
  const router = useRouter();
  const { success, error, info } = useToast();

  // State
  const [referralCode, setReferralCode] = useState("");
  const [referralsList, setReferralsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopying, setIsCopying] = useState(false);

  // Forms
  const [promoCode, setPromoCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
    fetchReferralData();
  }, [token]);

  const fetchReferralData = async () => {
    setIsLoading(true);
    try {
      // 1. Get or generate referral code
      const codeRes = await fetch("http://localhost:4000/billing/referral/code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      if (codeRes.ok) {
        const codeData = await codeRes.json();
        setReferralCode(codeData.referralCode);
      }

      // 2. Get list of successful referrals
      const listRes = await fetch("http://localhost:4000/billing/referral/list", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        setReferralsList(listData);
      }
    } catch (err) {
      console.error(err);
      error(isRtl ? "فشل تحميل إحصائيات الإحالات" : "Failed to load referral statistics");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!referralCode) return;
    setIsCopying(true);
    const link = `http://localhost:3000/register?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    success(isRtl ? "تم نسخ رابط الإحالة الخاص بك!" : "Referral link copied to clipboard!");
    setTimeout(() => setIsCopying(false), 2000);
  };

  const handleRedeemPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    setIsRedeeming(true);

    try {
      const res = await fetch("http://localhost:4000/billing/promo/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: promoCode.trim().toUpperCase() })
      });

      if (res.ok) {
        const data = await res.json();
        success(isRtl 
          ? `تم تفعيل الكوبون بنجاح! ربحت ${data.creditsGranted || 100} رصيد إضافي.` 
          : `Promo code redeemed! Earned ${data.creditsGranted || 100} bonus credits.`);
        setPromoCode("");
        refreshUser();
        fetchReferralData();
      } else {
        const errData = await res.json();
        error(errData.message || (isRtl ? "كوبون غير صالح أو انتهت صلاحيته" : "Invalid or expired promo code"));
      }
    } catch (err) {
      console.error(err);
      error(isRtl ? "حدث خطأ أثناء الاتصال بالخادم" : "Server communication error occurred");
    } finally {
      setIsRedeeming(false);
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

  // Calculate totals
  const totalEarnedCredits = referralsList.reduce((acc, curr) => acc + (curr.creditsReward || 50), 0);

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 flex flex-col" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Top Navbar */}
      <header className="h-16 border-b border-white/5 bg-zinc-950/40 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
            {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            <span className="text-xs font-bold">{isRtl ? "الرئيسية" : "Dashboard"}</span>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-purple-400" />
            <span className="font-extrabold text-sm text-white">{isRtl ? "برنامج الإحالة والكوبونات" : "Referral & Promo Hub"}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto px-6 py-10 flex-1 space-y-8 z-10 text-right rtl:text-right ltr:text-left">
        
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
          
          {/* Left panel - Promo code redeemer */}
          <div className="md:col-span-5 bg-gradient-to-br from-zinc-950 to-zinc-950/60 border border-zinc-900 p-6 rounded-3xl flex flex-col justify-between space-y-6 shadow-xl">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-purple-400" />
                <h3 className="text-base font-black text-white">{isRtl ? "تفعيل الكوبونات الترويجية" : "Redeem Promo Code"}</h3>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {isRtl 
                  ? "أدخل الرموز الترويجية أو كوبونات التخفيض والخصم لشحن رصيد محفظتك فورا بأرصدة Credits مجانية." 
                  : "Input discount vouchers or promo codes to claim immediate free credits into your balance wallet."}
              </p>
            </div>

            <form onSubmit={handleRedeemPromo} className="space-y-4">
              <Input
                placeholder={isRtl ? "مثال: CLIPAIBONUS" : "e.g. VIPCOUPON"}
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                className="py-2.5 text-xs text-center font-mono font-bold uppercase placeholder-zinc-650"
              />
              
              <Button
                type="submit"
                variant="primary"
                disabled={isRedeeming || !promoCode}
                className="w-full text-xs font-bold py-2.5"
              >
                {isRedeeming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  isRtl ? "تأكيد وتفعيل الكوبون" : "Redeem Promo Voucher"
                )}
              </Button>
            </form>

            <div className="bg-purple-950/5 border border-purple-500/10 p-3 rounded-2xl flex items-center justify-center gap-2 text-[10px] text-purple-400 font-semibold">
              <Sparkles className="h-4 w-4 animate-bounce" />
              <span>{isRtl ? "العروض والكوبونات صالحة للاستخدام مرة واحدة." : "Vouchers are single-use per customer account."}</span>
            </div>
          </div>

          {/* Right panel - Referral Link generator & Copy */}
          <div className="md:col-span-7 bg-[#0b0b0f] border border-white/5 p-6 rounded-3xl flex flex-col justify-between space-y-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-purple-400" />
                <h3 className="text-base font-black text-white">{isRtl ? "شارك كليب ذكاء واربح رصيد مجاني!" : "Invite Friends & Earn Credits"}</h3>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {isRtl 
                  ? "ارسل رابط الإحالة الخاص بك لأصدقائك أو صناع المحتوى. بمجرد قيامهم بالتسجيل وشحن حسابهم، ستحصل أنت وهم على رصيد إضافي مجاني كهدية انضمام!" 
                  : "Share your unique referral link. When they sign up and complete their first package upgrade, both of you earn credits!"}
              </p>
            </div>

            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-zinc-300 block">{isRtl ? "رابط الإحالة الخاص بك:" : "Your Invitation Link:"}</label>
              
              <div className="flex gap-2 items-center bg-zinc-950 border border-zinc-900 rounded-2xl p-2 pl-3">
                <button
                  onClick={handleCopyLink}
                  className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/15 p-2 rounded-xl transition-all cursor-pointer flex-shrink-0"
                  title="Copy link"
                >
                  {isCopying ? <Check className="h-4 w-4 text-green-400 animate-scale-up" /> : <Copy className="h-4 w-4" />}
                </button>
                
                <input
                  type="text"
                  readOnly
                  value={`http://localhost:3000/register?ref=${referralCode}`}
                  className="bg-transparent border-none text-xs font-mono text-zinc-400 flex-1 text-left outline-none pointer-events-all select-all dir-ltr"
                />
              </div>
            </div>

            {/* Micro analytics stats grid */}
            <div className="grid grid-cols-2 gap-4 border-t border-zinc-900 pt-4">
              <div className="space-y-1">
                <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider block">{isRtl ? "إجمالي الإحالات الناجحة" : "Total Referrals"}</span>
                <span className="text-xl font-black font-mono text-zinc-250 flex items-center gap-1.5 justify-end rtl:justify-end">
                  <Users2 className="h-4 w-4 text-purple-400" />
                  <span>{referralsList.length}</span>
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider block">{isRtl ? "الأرصدة المجانية المكتسبة" : "Referral Credits Earned"}</span>
                <span className="text-xl font-black font-mono text-green-400 flex items-center gap-1.5 justify-end rtl:justify-end">
                  <Award className="h-4 w-4 text-green-400" />
                  <span>+{totalEarnedCredits}</span>
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* Successful invitations list */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-900 pb-2">
            <Heart className="h-4 w-4 text-purple-400" />
            <h3 className="text-base font-black text-white">{isRtl ? "سجل الإحالات والأصدقاء المدعوين" : "Successful Referral Logs"}</h3>
          </div>

          {referralsList.length === 0 ? (
            <div className="text-center py-10 border border-zinc-900 border-dashed rounded-3xl text-xs text-zinc-500 font-semibold font-mono">
              {isRtl ? "لم تقم بدعوة أي مستخدمين بعد. شارك رابطك وابدأ الكسب!" : "No referral logs found yet. Start sharing to earn rewards!"}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {referralsList.map((ref) => (
                <div key={ref.id} className="bg-zinc-950/40 border border-zinc-900 p-4 rounded-2xl flex justify-between items-center text-xs">
                  <div className="space-y-1 pr-4 text-right">
                    <span className="font-bold text-zinc-300 block">{ref.referredUser?.email || "User Account"}</span>
                    <span className="text-[10px] text-zinc-500 font-mono block">{new Date(ref.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="text-green-400 font-mono font-extrabold flex items-center gap-1">
                    <span>+{ref.creditsReward || 50}</span>
                    <span className="text-[9px] font-semibold text-zinc-500 font-sans">{isRtl ? "رصيد" : "Credits"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
