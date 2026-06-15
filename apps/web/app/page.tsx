"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { Play, Sparkles, Wand2, ArrowRight, ShieldCheck, Zap, Coins, Globe } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";

export default function LandingPage() {
  const { t, isRtl, lang, setLang } = useI18n();
  const { user } = useAuth();
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 flex flex-col justify-between overflow-hidden relative animate-fade-in" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Decorative Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-950/10 blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-7xl w-full mx-auto px-6 h-16 flex items-center justify-between z-10 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-purple-400 animate-pulse" />
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            {t.common.appName}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 transition-colors"
          >
            <Globe className="h-3.5 w-3.5" />
            {lang === "en" ? "العربية" : "English"}
          </Button>

          {user ? (
            <Link href="/dashboard">
              <Button
                variant="primary"
                size="sm"
                className="font-bold flex items-center gap-1.5"
              >
                {t.common.dashboard}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button
                variant="outline"
                size="sm"
                className="font-bold text-white"
              >
                {t.common.login}
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl w-full mx-auto px-6 text-center py-20 z-10 space-y-8 flex-1 flex flex-col justify-center animate-slide-up">
        
        {/* Tagline Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/5 text-purple-400 text-xs font-semibold mx-auto w-fit shadow-[0_0_15px_rgba(139,92,246,0.1)]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{isRtl ? "مدعوم بنظام تدوير Gemini 1.5 الذكي" : "Powered by Gemini 1.5 Key Rotation Pools"}</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
          {isRtl ? (
            <>
              حوّل الفيديوهات الطويلة إلى <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                كليبات قصيرة سريعة الانتشار
              </span>
            </>
          ) : (
            <>
              Turn Long Videos Into <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                Viral Social Shorts
              </span>
            </>
          )}
        </h1>

        <p className="text-sm sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          {t.landing.heroSubtitle}
        </p>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <Link href="/login" className="w-full sm:w-auto">
            <Button
              variant="brand"
              size="lg"
              className="w-full font-bold flex items-center justify-center gap-2"
            >
              <span>{t.landing.getStarted}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setShowDemo(true)}
            className="w-full sm:w-auto font-bold flex items-center justify-center gap-2 border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700"
          >
            <Play className="h-4 w-4 text-purple-400" />
            <span>{t.landing.watchDemo}</span>
          </Button>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-16 text-right">
          <div className="p-6 rounded-2xl border border-white/5 bg-zinc-950/40 backdrop-blur-md space-y-3 glass-card-hover">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-white">{isRtl ? "ذكاء اصطناعي تلقائي" : "AI Auto Mode"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRtl
                ? "يقوم بتحليل نبرة الصوت والمواضيع وتحديد أفضل لقطات البودكاست تلقائياً دون تدخل يدوي."
                : "Analyzes speakers, voice tone, and hooks to extract the best viral moments automatically."}
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/5 bg-zinc-950/40 backdrop-blur-md space-y-3 glass-card-hover">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Coins className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-white">{isRtl ? "محفظة أرصدة ذكية" : "Credit Balance Wallet"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRtl
                ? "ادفع فقط مقابل ما تستهلكه فعلياً مع نظام مرن يوضح استهلاك كل عملية وخطوة بدقة."
                : "Pay only for what you run. Clear dashboard breakdown showing credit charges per stage."}
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/5 bg-zinc-950/40 backdrop-blur-md space-y-3 glass-card-hover">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-white">{isRtl ? "تدوير مفاتيح ذكي" : "API Key Rotation Pool"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRtl
                ? "توزيع أحمال وتخطي أخطاء تلقائي لضمان تشغيل المعالجة دون انقطاع أو بطء."
                : "Load balancing and key rotation fallback ensures zero downtime or rate limit blocks."}
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-zinc-500 z-10">
        <p>© 2026 {t.common.appName}. All rights reserved.</p>
      </footer>

      {/* Demo Video Modal */}
      <Modal
        isOpen={showDemo}
        onClose={() => setShowDemo(false)}
        title={isRtl ? "شاهد طريقة العمل والتقطيع الذكي" : "Watch How Reframing Studio Works"}
        size="sm"
      >
        <div className="space-y-4 text-center">
          <div className="aspect-[9/16] w-full max-w-[220px] mx-auto bg-black rounded-2xl overflow-hidden border border-zinc-800/80 relative shadow-2xl">
            <video
              src="http://localhost:4000/static/videos/sample.mp4"
              className="w-full h-full object-cover"
              controls
              autoPlay
              playsInline
            />
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            {isRtl ? "مقطع تجريبي يوضح تحويل الفيديو الأصلي 16:9 إلى شورتس 9:16 ذكي مع تتبع تلقائي وتلوين الترجمة." : "Sample preview demonstrating 16:9 widescreen re-oriented into vertical 9:16 shorts with automated tracker and timed karaoke subtitles."}
          </p>
        </div>
      </Modal>
    </div>
  );
}
