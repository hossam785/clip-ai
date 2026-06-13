"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "ar";

const translations = {
  en: {
    common: {
      appName: "Clip AI",
      home: "Home",
      dashboard: "Dashboard",
      admin: "Admin Keys",
      logout: "Log out",
      login: "Log In",
      signup: "Sign Up",
      credits: "Credits",
      loading: "Loading...",
      arabic: "العربية",
      english: "English",
    },
    landing: {
      heroTitle: "Turn Long Videos Into Viral Shorts",
      heroSubtitle: "Transform your podcast, interviews, and YouTube videos into high-impact TikToks, Reels, and Shorts using Gemini-powered AI clipping and auto face-reframing.",
      getStarted: "Get Started Free",
      watchDemo: "Watch Demo",
    },
    dashboard: {
      title: "My Dashboard",
      uploadTitle: "Create New Clips",
      youtubeLabel: "YouTube Video URL",
      youtubePlaceholder: "Paste a YouTube link here...",
      uploadLabel: "Or Upload File",
      uploadPlaceholder: "Drag and drop your MP4/WebM file here",
      aiMode: "AI Auto Generate",
      aiModeDesc: "AI analyzes text, sound, speakers and virality score. Returns optimal clips automatically.",
      manualMode: "Manual Select Mode",
      manualModeDesc: "Manually specify cut times, clip counts and target durations.",
      generateBtn: "Generate Clips",
      creditsCost: "Estimated Credit Cost",
      recentProjects: "Recent Projects",
    },
    editor: {
      title: "AI Clips Editor",
      backBtn: "Dashboard",
      exportBtn: "Export Clip",
      settingsTitle: "Clip Settings",
      fontStyle: "Subtitle Font Style",
      videoPlaceholder: "Video Player Placeholder",
      viralScore: "Viral Score",
    }
  },
  ar: {
    common: {
      appName: "كليب ذكاء",
      home: "الرئيسية",
      dashboard: "لوحة التحكم",
      admin: "مفاتيح الذكاء",
      logout: "تسجيل الخروج",
      login: "تسجيل الدخول",
      signup: "إنشاء حساب",
      credits: "الرصيد",
      loading: "جاري التحميل...",
      arabic: "العربية",
      english: "English",
    },
    landing: {
      heroTitle: "حوّل الفيديوهات الطويلة إلى مقاطع قصيرة سريعة الانتشار",
      heroSubtitle: "قم بتحويل البودكاست والمقابلات وفيديوهات اليوتيوب إلى مقاطع تيك توك وريلز وشورتس قوية باستخدام معالجة الذكاء الاصطناعي وتتبع الوجوه الذكي.",
      getStarted: "ابدأ مجاناً الآن",
      watchDemo: "مشاهدة العرض",
    },
    dashboard: {
      title: "لوحة التحكم الخاصة بي",
      uploadTitle: "إنشاء كليبات جديدة",
      youtubeLabel: "رابط فيديو يوتيوب",
      youtubePlaceholder: "أدخل رابط يوتيوب هنا...",
      uploadLabel: "أو ارفع ملف فيديو",
      uploadPlaceholder: "اسحب وأفلت ملف MP4/WebM الخاص بك هنا",
      aiMode: "توليد ذكي تلقائي (AI)",
      aiModeDesc: "يقوم الذكاء الاصطناعي بتحليل النص، المتحدثين والانتشار لتوليد أفضل اللقطات تلقائياً.",
      manualMode: "تحديد يدوي مخصص",
      manualModeDesc: "قم بتحديد أوقات التقطيع، أعداد الكليبات والمدد المستهدفة يدوياً.",
      generateBtn: "بدء معالجة الفيديو",
      creditsCost: "تكلفة الرصيد المتوقعة",
      recentProjects: "المشاريع الأخيرة",
    },
    editor: {
      title: "محرر الكليبات الذكي",
      backBtn: "لوحة التحكم",
      exportBtn: "تصدير الفيديو",
      settingsTitle: "إعدادات الكليب",
      fontStyle: "نمط خط الترجمة",
      videoPlaceholder: "مشغل الفيديو الافتراضي",
      viralScore: "معدل الانتشار",
    }
  }
};

interface I18nContextProps {
  lang: Language;
  setLang: (l: Language) => void;
  t: typeof translations.en;
  isRtl: boolean;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("ar");

  useEffect(() => {
    const saved = localStorage.getItem("clip-ai-lang") as Language;
    if (saved && (saved === "en" || saved === "ar")) {
      setLangState(saved);
    }
  }, []);

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem("clip-ai-lang", l);
  };

  const isRtl = lang === "ar";
  const t = translations[lang];

  return (
    <I18nContext.Provider value={{ lang, setLang, t, isRtl }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
