"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wand2, KeyRound, Mail, Sparkles, Loader2, ArrowRight } from "lucide-react";

export default function RegisterPage() {
  const { register } = useAuth();
  const { t, isRtl } = useI18n();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      await register(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to register");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] flex flex-col md:flex-row text-zinc-100" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Left Column - Glowing Promo */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-zinc-950 via-zinc-900 to-purple-950/40 relative overflow-hidden items-center justify-center p-12 border-e border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.06),transparent_60%)]" />
        
        <div className="space-y-6 max-w-sm z-10 text-right">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/5 text-purple-400 text-xs font-semibold shadow-[0_0_15px_rgba(139,92,246,0.15)] animate-bounce">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isRtl ? "توليد ذكي متكامل" : "Comprehensive AI Generation"}</span>
          </div>

          <h2 className="text-3xl font-black leading-tight text-white">
            {isRtl ? "أنشئ حساباً مجانياً الآن" : "Create a free account today"}
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {isRtl 
              ? "واحصل على 100 رصيد مجاني للبدء في توليد وقص كليبات فيديو مميزة لشبكات التواصل الاجتماعي."
              : "Get 100 free starting credits. Experience instant speaker reframing and custom word highlighting."}
          </p>
        </div>
      </div>

      {/* Right Column - Clean Register Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 z-10 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-purple-900/5 blur-[80px] pointer-events-none" />

        <div className="w-full max-w-md space-y-8 glass-panel p-8 sm:p-10 rounded-3xl border border-white/5">
          <div className="flex flex-col items-center space-y-2 text-center">
            <div className="flex items-center gap-1.5">
              <Wand2 className="h-6 w-6 text-purple-400" />
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                {t.common.appName}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white pt-2">
              {isRtl ? "إنشاء حساب جديد" : "Create your account"}
            </h3>
            <p className="text-xs text-zinc-500">
              {isRtl ? "ابدأ تحويل فيديوهاتك الطويلة اليوم" : "Get started with Clip AI"}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl text-center">
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-purple-400" />
                <span>{isRtl ? "البريد الإلكتروني" : "Email Address"}</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@clipai.com"
                className="w-full bg-zinc-950 text-xs px-4 py-3 rounded-xl border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors text-right"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                <KeyRound className="h-3.5 w-3.5 text-purple-400" />
                <span>{isRtl ? "كلمة المرور" : "Password"}</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-950 text-xs px-4 py-3 rounded-xl border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors text-right"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-6 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t.common.loading}</span>
                </>
              ) : (
                <>
                  <span>{t.common.signup}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center text-xs text-zinc-500 pt-2">
            <span>{isRtl ? "لديك حساب بالفعل؟" : "Already have an account?"} </span>
            <Link href="/login" className="text-purple-400 font-bold hover:underline">
              {t.common.login}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
