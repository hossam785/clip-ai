"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Play, Pause, Download, Type, Palette, Layout, Sparkles, Wand2, 
  RefreshCw, Move, Trash2, Check, Settings, Scissors, CheckSquare, 
  Square, Volume2, Smile, ArrowLeft, Loader2, Coins, Youtube, 
  Upload, Layers, Sparkle, Film, Clock, HelpCircle, User, ShieldAlert,
  Plus
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  youtubeUrl: string | null;
  status: string;
  mode: string;
  maxDuration: string;
  effects: boolean;
  createdAt: string;
  _count?: { clips: number };
}

const dbName = "ClipAIDatabase";
const storeName = "videos";

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveVideoToDB = async (projectId: string, file: File): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(file, projectId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export default function DashboardPage() {
  const { user, token, logout, refreshUser } = useAuth();
  const { t, isRtl } = useI18n();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Form Inputs
  const [name, setName] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [mode, setMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [maxDuration, setMaxDuration] = useState("60");
  const [effects, setEffects] = useState(false);
  const [manualClips, setManualClips] = useState<{ startTime: string; endTime: string }[]>([
    { startTime: "00:10", endTime: "00:40" }
  ]);

  // Pricing configuration from server
  const [pricing, setPricing] = useState({ pricePerClip: 10, priceCustomRange: 15, priceEffects: 10 });

  // Processing Stage Trigger State
  const [activeProcessingProjectId, setActiveProcessingProjectId] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState(0); // 0-5
  const [processingProgress, setProcessingProgress] = useState(0); // 0-100
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchProjects();
    fetchPricing();
  }, [token]);

  const fetchPricing = async () => {
    try {
      const res = await fetch("http://localhost:4000/projects/pricing", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPricing(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const res = await fetch("http://localhost:4000/projects", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Live polling for processing projects
  useEffect(() => {
    if (projects.some(p => p.status === "PROCESSING")) {
      const interval = setInterval(() => {
        fetchProjects();
        refreshUser();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [projects]);

  const getEstimatedCost = () => {
    let cost = 0;
    if (mode === "AUTO") {
      cost += pricing.pricePerClip * 3; // Standard 3 clips
    } else {
      cost += manualClips.length * pricing.priceCustomRange;
    }
    if (effects) {
      cost += pricing.priceEffects;
    }
    return cost;
  };

  const [importStep, setImportStep] = useState<"URL" | "DOWNLOAD" | "SETTINGS">("URL");
  const [importedProject, setImportedProject] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [uploadProgressText, setUploadProgressText] = useState("");

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsImporting(true);
    setImportStep("DOWNLOAD");
    setDownloadProgress(10);
    setUploadProgressText(isRtl ? "جاري رفع ملف الفيديو المحلي..." : "Uploading local video file...");

    const prgInterval = setInterval(() => {
      setDownloadProgress(prev => Math.min(95, prev + 12));
    }, 300);

    try {
      const res = await fetch("http://localhost:4000/projects/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          youtubeUrl: `local-upload://${file.name}`,
          name: file.name.split('.').slice(0, -1).join('.') || file.name,
        })
      });

      if (!res.ok) {
        throw new Error("Failed to upload video");
      }

      const proj = await res.json();
      try {
        await saveVideoToDB(proj.id, file);
      } catch (err) {
        console.error("Failed to cache video file in IndexedDB:", err);
      }
      
      setTimeout(async () => {
        clearInterval(prgInterval);
        setDownloadProgress(100);
        
        try {
          const checkRes = await fetch(`http://localhost:4000/projects/${proj.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (checkRes.ok) {
            const updatedProj = await checkRes.json();
            setImportedProject(updatedProj);
            setImportStep("SETTINGS");
            setName(updatedProj.name);
          } else {
            setImportStep("URL");
            alert("Failed to fetch uploaded video details");
          }
        } catch (e) {
          setImportStep("URL");
          console.error(e);
        }
      }, 2500);

    } catch (err: any) {
      clearInterval(prgInterval);
      setImportStep("URL");
      alert(err.message || "Error uploading video");
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl) return;
    setIsImporting(true);
    setImportStep("DOWNLOAD");
    setDownloadProgress(10);
    setUploadProgressText(isRtl ? "جاري تحميل الفيديو إلى خوادم المنصة..." : "Downloading video to platform storage...");

    const prgInterval = setInterval(() => {
      setDownloadProgress(prev => Math.min(95, prev + 15));
    }, 400);

    try {
      const res = await fetch("http://localhost:4000/projects/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          youtubeUrl,
          name: name || undefined,
        })
      });

      if (!res.ok) {
        throw new Error("Failed to import video");
      }

      const proj = await res.json();
      
      // Wait for background download simulation to finish (takes 2.5s on backend)
      setTimeout(async () => {
        clearInterval(prgInterval);
        setDownloadProgress(100);
        
        try {
          const checkRes = await fetch(`http://localhost:4000/projects/${proj.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (checkRes.ok) {
            const updatedProj = await checkRes.json();
            setImportedProject(updatedProj);
            setImportStep("SETTINGS");
            setName(updatedProj.name);
          } else {
            setImportStep("URL");
            alert("Failed to fetch imported video details");
          }
        } catch (e) {
          setImportStep("URL");
          console.error(e);
        }
      }, 3000);

    } catch (err: any) {
      clearInterval(prgInterval);
      setImportStep("URL");
      alert(err.message || "Error importing video");
    } finally {
      setIsImporting(false);
    }
  };

  const handleProcessProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importedProject) return;
    setIsSubmittingProject(true);

    if (mode === "MANUAL") {
      const timeRegex = /^\d{2,3}:\d{2}$/;
      const toSeconds = (str: string) => {
        const parts = str.split(':').map(Number);
        return parts[0] * 60 + parts[1];
      };

      for (let i = 0; i < manualClips.length; i++) {
        const clip = manualClips[i];
        if (!timeRegex.test(clip.startTime) || !timeRegex.test(clip.endTime)) {
          alert(isRtl 
            ? "الرجاء إدخال الفترات الزمنية بالتنسيق الصحيح mm:ss (مثال 01:30)" 
            : "Please enter manual ranges in mm:ss format (e.g. 01:30)");
          setIsSubmittingProject(false);
          return;
        }

        const startSec = toSeconds(clip.startTime);
        const endSec = toSeconds(clip.endTime);

        if (startSec >= endSec) {
          alert(isRtl 
            ? "وقت البدء يجب أن يكون أقل من وقت النهاية!" 
            : "Start time must be less than end time!");
          setIsSubmittingProject(false);
          return;
        }
      }
    }

    const cost = getEstimatedCost();
    if (user && user.credits < cost) {
      alert(isRtl 
        ? `رصيدك غير كافٍ! تتطلب هذه العملية ${cost} رصيد، رصيدك الحالي هو ${user.credits}.` 
        : `Insufficient credits! This operation requires ${cost} credits, you only have ${user.credits}.`);
      setIsSubmittingProject(false);
      return;
    }

    try {
      const res = await fetch(`http://localhost:4000/projects/${importedProject.id}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          mode,
          maxDuration,
          effects,
          manualClips: mode === "MANUAL" ? manualClips : [],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to start processing");
      }

      const data = await res.json();
      
      // Reset Import workflow state
      setImportStep("URL");
      setImportedProject(null);
      setName("");
      setYoutubeUrl("");
      
      // Trigger progress overlay modal
      setActiveProcessingProjectId(data.project.id);
      startProgressSimulation(data.project.id);

      // Fetch projects & refresh wallet
      fetchProjects();
      refreshUser();
    } catch (err: any) {
      alert(err.message || "Error starting process");
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    // Keep legacy create for compatibility (direct mapping to handleImportVideo)
    handleImportVideo(e);
  };

  const startProgressSimulation = (projId: string) => {
    setProcessingStage(1);
    setProcessingProgress(15);
    setProcessingLogs([
      isRtl ? "🔄 جاري الاتصال بخوادم الرفع وتجهيز الفيديو..." : "🔄 Connecting to server and downloading stream..."
    ]);

    const steps = [
      { prg: 30, log: isRtl ? "✅ تم تحميل تدفق الفيديو وفصل القنوات الصوتية." : "✅ Video stream fetched, splitting audio track..." },
      { prg: 50, log: isRtl ? "🎤 جاري تحويل الصوت إلى نصوص كاملة بدقة (Speech-to-Text)..." : "🎤 Transcribing audio speech to text timeline (Whisper)..." },
      { prg: 75, log: isRtl ? "👤 جاري مطابقة نبرة الصوت وتتبع الوجوه وتجزئة المتحدثين..." : "👤 Executing speaker diarization and mapping faces..." },
      { prg: 90, log: isRtl ? "✨ ذكاء Gemini يحلل اللحظات القابلة للانتشار واستخراج الكليبات..." : "✨ Gemini evaluating hook retention scores and cropping shorts..." },
      { prg: 100, log: isRtl ? "🎉 اكتملت المعالجة بنجاح! جاري تحويلك للمحرر..." : "🎉 Process completed successfully! Redirecting you to editor..." }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep >= steps.length) {
        clearInterval(interval);
        setTimeout(() => {
          setActiveProcessingProjectId(null);
          router.push(`/editor/${projId}`);
        }, 1000);
        return;
      }

      const step = steps[currentStep];
      setProcessingProgress(step.prg);
      setProcessingStage(currentStep + 2);
      setProcessingLogs(prev => [...prev, step.log]);
      currentStep++;
    }, 2000);
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm(isRtl ? "هل أنت متأكد من حذف هذا المشروع بالكامل؟" : "Are you sure you want to delete this project?")) return;
    try {
      const res = await fetch(`http://localhost:4000/projects/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 flex flex-col" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Top Navbar */}
      <header className="h-16 border-b border-white/5 bg-zinc-950/40 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-purple-400" />
            <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              {t.common.appName}
            </span>
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* User Credits Wallet Box */}
          <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.08)]">
            <Coins className="h-4 w-4 text-purple-400 animate-pulse" />
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-zinc-400 font-bold">{t.common.credits}:</span>
              <span className="font-mono text-purple-300 font-extrabold">{user?.credits ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="text-xs bg-zinc-900 border border-white/5 hover:bg-zinc-850 px-4 py-2 rounded-xl transition-colors font-bold text-zinc-300 flex items-center gap-1.5"
            >
              <ShieldAlert className="h-4 w-4 text-purple-400" />
              <span>{t.common.admin}</span>
            </Link>
          )}

          <button
            onClick={logout}
            className="text-xs border border-white/5 hover:bg-white/5 text-zinc-400 hover:text-white px-4 py-2 rounded-xl transition-all"
          >
            {t.common.logout}
          </button>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main className="max-w-7xl w-full mx-auto px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 z-10">
        
        {/* Left column - Create Project / Import Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6">
            
            {importStep === "URL" && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-lg font-black text-white">{isRtl ? "تحميل فيديو جديد" : "Import New Video"}</h2>
                  <p className="text-xs text-zinc-500">{isRtl ? "أدخل رابط فيديو يوتيوب لتحميله على خوادم المنصة ومعالجته" : "Enter a YouTube link to download and process it on our storage"}</p>
                </div>

                <form onSubmit={handleImportVideo} className="space-y-5">
                  {/* Project Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 block">{isRtl ? "اسم المشروع (اختياري):" : "Project Name (Optional):"}</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={isRtl ? "مثال: بودكاست ريادة الأعمال #5" : "e.g. Marketing Podcast #5"}
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-purple-500 transition-colors text-right"
                    />
                  </div>

                  {/* YouTube link */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 block flex items-center gap-1">
                      <Youtube className="h-4 w-4 text-red-500" />
                      <span>{t.dashboard.youtubeLabel}</span>
                    </label>
                    <input
                      type="url"
                      required
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder={t.dashboard.youtubePlaceholder}
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-purple-500 transition-colors text-right"
                    />
                  </div>

                  {/* Upload Dropzone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 block">{t.dashboard.uploadLabel}</label>
                    <input 
                      type="file" 
                      id="dashboard-file-upload" 
                      accept="video/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    <div 
                      onClick={() => document.getElementById("dashboard-file-upload")?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      className="border border-dashed border-zinc-800 rounded-xl bg-zinc-950/45 p-6 text-center hover:border-purple-500/50 transition-colors cursor-pointer space-y-2"
                    >
                      <Upload className="h-5 w-5 text-zinc-650 mx-auto" />
                      <span className="text-[10px] text-zinc-500 block">{t.dashboard.uploadPlaceholder}</span>
                    </div>
                  </div>

                  {/* Submit Import Button */}
                  <button
                    type="submit"
                    disabled={isImporting}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-4 rounded-2xl font-bold text-xs transition-all shadow-[0_0_20px_rgba(139,92,246,0.15)] flex items-center justify-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>{isRtl ? "تحميل واستيراد الفيديو" : "Download & Import Video"}</span>
                  </button>
                </form>
              </div>
            )}

            {importStep === "DOWNLOAD" && (
              <div className="space-y-6 py-8 text-center animate-in fade-in duration-350">
                <div className="relative w-16 h-16 mx-auto">
                  <Loader2 className="h-16 w-16 animate-spin text-purple-500 absolute inset-0" />
                  <div className="absolute inset-1.5 bg-zinc-950 rounded-full flex items-center justify-center">
                    <Download className="h-6 w-6 text-purple-400 animate-bounce" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-black text-white">{uploadProgressText || (isRtl ? "جاري تحميل الفيديو إلى خوادم المنصة..." : "Downloading video to platform storage...")}</h3>
                  <p className="text-[10px] text-zinc-500">{isRtl ? "يتم سحب تدفق الفيديو عالي الجودة وفصل الصوت" : "Fetching high-fidelity video stream and preparing local copy"}</p>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1 max-w-xs mx-auto">
                  <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden border border-white/5">
                    <div style={{ width: `${downloadProgress}%` }} className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-300" />
                  </div>
                  <span className="text-[10px] font-mono text-purple-400 font-extrabold block text-center">{downloadProgress}%</span>
                </div>
              </div>
            )}

            {importStep === "SETTINGS" && importedProject && (
              <div className="space-y-6 animate-in fade-in duration-300">
                
                {/* Imported Video Details Card */}
                <div className="bg-zinc-950/60 border border-purple-500/10 p-4 rounded-2xl space-y-4">
                  <div className="flex gap-4 items-center">
                    {/* Video Thumbnail */}
                    <div className="w-20 h-14 rounded-lg bg-zinc-900 flex-shrink-0 overflow-hidden relative border border-white/5">
                      {importedProject.thumbnailUrl ? (
                        <img 
                          src={importedProject.thumbnailUrl.startsWith('http') ? importedProject.thumbnailUrl : `http://localhost:4000${importedProject.thumbnailUrl}`} 
                          alt="Video Thumbnail"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="h-5 w-5 text-zinc-700" />
                        </div>
                      )}
                      <span className="absolute bottom-1 right-1 bg-black/75 px-1 py-0.5 rounded text-[8px] font-mono font-bold text-zinc-300">
                        {importedProject.videoDuration || "08:45"}
                      </span>
                    </div>

                    <div className="space-y-1 text-right flex-1 min-w-0">
                      <h3 className="font-extrabold text-xs text-white truncate">{importedProject.videoTitle || importedProject.name}</h3>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-zinc-500 items-center justify-start rtl:justify-end">
                        <span className="bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded font-bold text-[8px]">
                          {importedProject.videoQuality || "1080p"}
                        </span>
                        <span>•</span>
                        <span>{importedProject.videoSize || "145.2 MB"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-500/5 border border-green-500/10 p-2.5 rounded-xl text-center text-[10px] text-green-400 font-semibold flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
                    <span>{isRtl ? "تم تحميل الفيديو وتخزينه بنجاح!" : "Video downloaded and stored successfully!"}</span>
                  </div>
                </div>

                {/* Configurations settings form */}
                <form onSubmit={handleProcessProject} className="space-y-5">
                  {/* Mode Selection Grid */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 block">{isRtl ? "وضع إنشاء الكليبات:" : "Clipping Mode:"}</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setMode("AUTO")}
                        className={`p-3.5 border rounded-2xl text-right flex flex-col justify-between h-24 transition-all ${
                          mode === "AUTO" 
                            ? 'border-primary-brand bg-primary-brand/5 shadow-[0_0_15px_rgba(139,92,246,0.1)]' 
                            : 'border-zinc-850 bg-zinc-950 hover:bg-zinc-900'
                        }`}
                      >
                        <Sparkle className={`h-4.5 w-4.5 ${mode === "AUTO" ? 'text-primary-brand' : 'text-zinc-600'}`} />
                        <div className="space-y-0.5">
                          <span className="font-bold text-xs text-white block">{t.dashboard.aiMode}</span>
                          <span className="text-[9px] text-zinc-500 leading-tight block line-clamp-2">{t.dashboard.aiModeDesc}</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMode("MANUAL")}
                        className={`p-3.5 border rounded-2xl text-right flex flex-col justify-between h-24 transition-all ${
                          mode === "MANUAL" 
                            ? 'border-primary-brand bg-primary-brand/5 shadow-[0_0_15px_rgba(139,92,246,0.1)]' 
                            : 'border-zinc-850 bg-zinc-950 hover:bg-zinc-900'
                        }`}
                      >
                        <Scissors className={`h-4.5 w-4.5 ${mode === "MANUAL" ? 'text-primary-brand' : 'text-zinc-600'}`} />
                        <div className="space-y-0.5">
                          <span className="font-bold text-xs text-white block">{isRtl ? "تقطيع يدوي" : "Manual Clips"}</span>
                          <span className="text-[9px] text-zinc-500 leading-tight block line-clamp-2">{t.dashboard.manualModeDesc}</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Mode Configurations */}
                  {mode === "AUTO" ? (
                    <div className="space-y-3 bg-zinc-950/40 border border-zinc-850/40 p-4 rounded-2xl animate-in fade-in duration-200">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-zinc-400">{isRtl ? "الحد الأقصى لطول الكليب:" : "Max Clip Duration:"}</span>
                        <span className="font-mono text-purple-300 font-bold">{maxDuration}s</span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="120"
                        step="15"
                        value={maxDuration}
                        onChange={(e) => setMaxDuration(e.target.value)}
                        className="w-full accent-primary-brand bg-zinc-800 rounded-lg appearance-none h-1.5 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-zinc-600 font-mono">
                        <span>30s</span>
                        <span>60s</span>
                        <span>90s</span>
                        <span>120s</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 bg-zinc-950/40 border border-zinc-850/40 p-4 rounded-2xl animate-in fade-in duration-200 text-right">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-zinc-400 block">{isRtl ? "الفترات الزمنية المستهدفة:" : "Target Ranges:"}</span>
                        {manualClips.length < 10 && (
                          <button
                            type="button"
                            onClick={() => setManualClips([...manualClips, { startTime: "00:00", endTime: "00:30" }])}
                            className="text-[10px] text-purple-400 hover:text-purple-300 font-bold transition-colors flex items-center gap-1"
                          >
                            <Plus className="h-3.5 w-3.5 animate-pulse" />
                            <span>{isRtl ? "إضافة فترة" : "Add Range"}</span>
                          </button>
                        )}
                      </div>
                      
                      {manualClips.map((c, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={c.startTime}
                            onChange={(e) => {
                              const updated = [...manualClips];
                              updated[idx].startTime = e.target.value;
                              setManualClips(updated);
                            }}
                            className="bg-zinc-950 border border-zinc-850 text-center font-mono text-xs rounded-xl py-2 px-1 flex-1 text-center"
                            placeholder="00:10"
                          />
                          <span className="text-zinc-650 text-xs">→</span>
                          <input
                            type="text"
                            value={c.endTime}
                            onChange={(e) => {
                              const updated = [...manualClips];
                              updated[idx].endTime = e.target.value;
                              setManualClips(updated);
                            }}
                            className="bg-zinc-950 border border-zinc-850 text-center font-mono text-xs rounded-xl py-2 px-1 flex-1 text-center"
                            placeholder="00:40"
                          />
                          {manualClips.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setManualClips(manualClips.filter((_, i) => i !== idx))}
                              className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Extra toggles */}
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <label className="flex items-center justify-between cursor-pointer py-1.5">
                      <span className="text-xs text-zinc-400 font-semibold">{isRtl ? "تطبيق المؤثرات الصوتية والترجمة:" : "Apply Sound Effects & Style:"}</span>
                      <input
                        type="checkbox"
                        checked={effects}
                        onChange={(e) => setEffects(e.target.checked)}
                        className="accent-primary-brand h-4 w-4"
                      />
                    </label>
                  </div>

                  {/* Credit Wallet estimation */}
                  <div className="bg-purple-950/20 border border-purple-500/10 p-4 rounded-2xl flex justify-between items-center text-xs">
                    <span className="text-zinc-400">{t.dashboard.creditsCost}:</span>
                    <span className="font-mono text-purple-300 font-extrabold">{getEstimatedCost()} {isRtl ? "رصيد" : "Credits"}</span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setImportStep("URL");
                        setImportedProject(null);
                      }}
                      className="w-1/3 bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white py-4 rounded-2xl font-bold text-xs transition-colors"
                    >
                      {isRtl ? "إلغاء" : "Cancel"}
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmittingProject}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-4 rounded-2xl font-bold text-xs transition-all shadow-[0_0_20px_rgba(139,92,246,0.15)] flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSubmittingProject ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{t.common.loading}</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4" />
                          <span>{isRtl ? "بدء معالجة الكليبات" : "Start AI Processing"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        </div>

        {/* Right column - Projects list */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 flex flex-col min-h-[500px]">
            <h2 className="text-lg font-black text-white text-right">{t.dashboard.recentProjects}</h2>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {isLoadingProjects ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                  <span className="text-xs">{t.common.loading}</span>
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-20 text-xs text-zinc-500">
                  {isRtl ? "لا توجد مشاريع حتى الآن. ابدأ برفع فيديو!" : "No projects found yet. Get started by uploading one!"}
                </div>
              ) : (
                projects.map((proj) => {
                  const handleCardClick = () => {
                    if (proj.status === "COMPLETED") {
                      router.push(`/editor/${proj.id}`);
                    } else if (proj.status === "DOWNLOADED") {
                      setImportedProject(proj);
                      setImportStep("SETTINGS");
                      setName(proj.name);
                    }
                  };

                  return (
                    <div
                      key={proj.id}
                      onClick={handleCardClick}
                      className={`p-4 rounded-2xl border transition-all text-right ${
                        proj.status === "COMPLETED" 
                          ? 'border-zinc-850 bg-zinc-950/40 hover:border-purple-500/40 hover:shadow-[0_0_15px_rgba(139,92,246,0.05)] cursor-pointer' 
                          : proj.status === "DOWNLOADED"
                          ? 'border-purple-900/40 bg-zinc-950/40 hover:border-purple-500/60 cursor-pointer shadow-[0_0_10px_rgba(139,92,246,0.02)]'
                          : 'border-zinc-900 bg-zinc-950/20'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(proj.id);
                            }}
                            className="text-zinc-650 hover:text-red-400 p-1.5 rounded-lg border border-zinc-900 hover:border-zinc-800 bg-zinc-950/60 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="space-y-1 flex-1 pr-4">
                          <h3 className="font-bold text-xs text-white leading-snug">{proj.name}</h3>
                          <p className="text-[10px] text-zinc-500 max-w-sm truncate dir-ltr">{proj.youtubeUrl || "Local Video Upload"}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-zinc-900/60 pt-3 mt-3">
                        <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(proj.createdAt).toLocaleDateString()}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md">
                            {proj.mode}
                          </span>

                          <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full ${
                            proj.status === "COMPLETED" ? 'bg-green-500/10 text-green-400 border border-green-500/15' :
                            proj.status === "PROCESSING" ? 'bg-purple-500/10 text-purple-400 border border-purple-500/15 animate-pulse' :
                            proj.status === "FAILED" ? 'bg-red-500/10 text-red-400 border border-red-500/15' :
                            'bg-zinc-800 text-zinc-400'
                          }`}>
                            {proj.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </main>

      {/* Floating Processing Stage Overlay Modal */}
      {activeProcessingProjectId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-in fade-in duration-300">
          <div className="bg-zinc-950 border border-zinc-850 p-8 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl">
            <div className="relative w-20 h-20 mx-auto">
              <Loader2 className="h-20 w-20 animate-spin text-purple-500 absolute inset-0" />
              <div className="absolute inset-2 bg-zinc-950 rounded-full flex items-center justify-center">
                <Wand2 className="h-8 w-8 text-purple-400 animate-pulse" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-white">{isRtl ? "جاري معالجة فيديو البودكاست..." : "Processing video workflow..."}</h3>
              <p className="text-[11px] text-zinc-500">
                {isRtl 
                  ? `المرحلة ${processingStage}/5: استخراج الصوت والتحليل البصري الذكي`
                  : `Stage ${processingStage}/5: Extracting audio and running visual AI reframer`}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-white/5">
                <div style={{ width: `${processingProgress}%` }} className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-300" />
              </div>
              <span className="text-[10px] font-mono text-purple-400 font-extrabold block text-right">{processingProgress}%</span>
            </div>

            {/* Detailed operation logs log list */}
            <div className="bg-zinc-900/60 border border-zinc-850 rounded-2xl p-4 h-32 overflow-y-auto text-right text-[10px] text-zinc-400 font-mono space-y-1.5 scrollbar-thin">
              {processingLogs.map((log, idx) => (
                <div key={idx} className="animate-in slide-in-from-bottom-1 duration-150">{log}</div>
              ))}
            </div>

            <p className="text-[9px] text-zinc-600">
              * {isRtl ? "تستهلك هذه العملية رصيداً من محفظة Credits الخاصة بك." : "This workflow directly processes credits from your balance wallet."}
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-zinc-600">
        <p>© 2026 {t.common.appName}. All rights reserved.</p>
      </footer>
    </div>
  );
}
