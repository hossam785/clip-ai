"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Play, Download, Sparkles, Wand2, 
  Trash2, ShieldAlert, Coins, Youtube, 
  Upload, Film, Clock, HelpCircle, Check, Loader2, CreditCard, ArrowRight
} from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Dropdown } from "../../components/ui/Dropdown";
import { Tabs } from "../../components/ui/Tabs";
import { Tooltip } from "../../components/ui/Tooltip";
import { useToast } from "../../components/ui/Toast";
import { EmptyState } from "../../components/ui/EmptyState";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";

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
  videos?: any[];
  bestClipScore?: number;
  categoriesFound?: string | null;
  processingState?: string | null;
  clipGenerationCount?: number;
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
  const { success, error, info, warning } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Tabs state
  const [activeTab, setActiveTab] = useState("projects");

  // Form Inputs
  const [name, setName] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [mode, setMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [maxDuration, setMaxDuration] = useState("60");
  const [effects, setEffects] = useState(false);
  const [manualClips, setManualClips] = useState<{ startTime: string; endTime: string }[]>([
    { startTime: "00:10", endTime: "00:40" }
  ]);

  // Billing and plans state
  const [balanceDetails, setBalanceDetails] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [isSubscribing, setIsSubscribing] = useState<string | null>(null);

  // Pricing configuration from server
  const [pricing, setPricing] = useState({ pricePerClip: 10, priceCustomRange: 15, priceEffects: 10 });

  // Processing Stage Trigger State
  const [activeProcessingProjectId, setActiveProcessingProjectId] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState(0); // 0-5
  const [processingProgress, setProcessingProgress] = useState(0); // 0-100
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);

  // Phase 2 Filters, Search, Sort & Pagination states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date-desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Import states
  const [importStep, setImportStep] = useState<"URL" | "DOWNLOAD" | "SETTINGS">("URL");
  const [importedProject, setImportedProject] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [uploadProgressText, setUploadProgressText] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchProjects();
    fetchPricing();
    fetchBillingDetails();
  }, [token]);

  useEffect(() => {
    if (activeTab === "billing" && token) {
      fetchBillingDetails();
    }
  }, [activeTab]);

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
      error(isRtl ? "فشل جلب المشاريع." : "Failed to load projects.");
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const fetchBillingDetails = async () => {
    try {
      const res = await fetch("http://localhost:4000/billing/balance", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBalanceDetails(data);
      }

      const txRes = await fetch("http://localhost:4000/billing/transactions", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData);
      }

      const plansRes = await fetch("http://localhost:4000/billing/plans");
      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Live polling for processing projects
  useEffect(() => {
    if (projects.some(p => p.status === "PROCESSING")) {
      const interval = setInterval(() => {
        fetchProjects();
        refreshUser();
        if (activeTab === "billing") {
          fetchBillingDetails();
        }
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

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsImporting(true);
    setImportStep("DOWNLOAD");
    setUploadProgressText(isRtl ? "جاري تجهيز الرفع..." : "Preparing upload...");
    setDownloadProgress(0);

    try {
      // 1. Create a project skeleton for the upload
      const initName = name || file.name.split('.').slice(0, -1).join('.') || file.name;
      const res = await fetch("http://localhost:4000/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: initName,
          mode: "AUTO",
          maxDuration: "60",
          effects: false,
        })
      });

      if (!res.ok) throw new Error("Failed to initialize project skeleton");
      const data = await res.json();
      const proj = data.project;

      // Cache file locally in IndexedDB as fall-back
      try {
        await saveVideoToDB(proj.id, file);
      } catch (err) {
        console.error("Failed to cache video file in IndexedDB:", err);
      }

      // 2. Perform chunked upload
      const chunkSize = 2 * 1024 * 1024; // 2MB chunks
      const totalChunks = Math.ceil(file.size / chunkSize);
      const startTime = Date.now();

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(file.size, start + chunkSize);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append("projectId", proj.id);
        formData.append("chunkIndex", i.toString());
        formData.append("totalChunks", totalChunks.toString());
        formData.append("fileName", file.name);
        formData.append("file", chunk, file.name);

        const uploadRes = await fetch("http://localhost:4000/projects/upload-chunk", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        });

        if (!uploadRes.ok) throw new Error("Chunk upload failed");

        // Calculate progress stats
        const bytesUploaded = end;
        const progressPercent = Math.round((bytesUploaded / file.size) * 100);
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const uploadSpeedBytesSec = elapsedSeconds > 0 ? bytesUploaded / elapsedSeconds : 0;
        const uploadSpeedMB = (uploadSpeedBytesSec / (1024 * 1024)).toFixed(2);
        
        const remainingBytes = file.size - bytesUploaded;
        const remainingSeconds = uploadSpeedBytesSec > 0 ? Math.ceil(remainingBytes / uploadSpeedBytesSec) : 0;
        
        const formatTime = (sec: number) => {
          const m = Math.floor(sec / 60);
          const s = sec % 60;
          return `${m}:${s.toString().padStart(2, '0')}`;
        };

        setDownloadProgress(progressPercent);
        setUploadProgressText(
          isRtl
            ? `جاري رفع أجزاء الفيديو: ${progressPercent}% (${uploadSpeedMB} MB/s) - المتبقي تقريباً ${formatTime(remainingSeconds)}`
            : `Uploading chunks: ${progressPercent}% (${uploadSpeedMB} MB/s) - Est. time remaining: ${formatTime(remainingSeconds)}`
        );
      }

      // Upload finished!
      success(isRtl ? "تم رفع الفيديو بنجاح وجاري استخراج البيانات!" : "Video uploaded successfully. Extracting details!");
      setImportStep("URL");
      setName("");
      fetchProjects();
    } catch (err: any) {
      error(err.message || (isRtl ? "خطأ أثناء الرفع." : "Error uploading file."));
      setImportStep("URL");
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
            success(isRtl ? "تم استيراد الفيديو بنجاح!" : "Video imported successfully!");
          } else {
            setImportStep("URL");
            error(isRtl ? "فشل التحقق من تفاصيل الفيديو المستورد." : "Failed to verify imported video details.");
          }
        } catch (e) {
          setImportStep("URL");
          console.error(e);
        }
      }, 3000);

    } catch (err: any) {
      clearInterval(prgInterval);
      setImportStep("URL");
      error(err.message || (isRtl ? "خطأ في استيراد الفيديو." : "Error importing video."));
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
          warning(isRtl 
            ? "الرجاء إدخال الفترات الزمنية بالتنسيق الصحيح mm:ss (مثال 01:30)" 
            : "Please enter manual ranges in mm:ss format (e.g. 01:30)");
          setIsSubmittingProject(false);
          return;
        }

        const startSec = toSeconds(clip.startTime);
        const endSec = toSeconds(clip.endTime);

        if (startSec >= endSec) {
          warning(isRtl 
            ? "وقت البدء يجب أن يكون أقل من وقت النهاية!" 
            : "Start time must be less than end time!");
          setIsSubmittingProject(false);
          return;
        }
      }
    }

    const cost = getEstimatedCost();
    if (user && user.credits < cost) {
      error(isRtl 
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
      fetchBillingDetails();
    } catch (err: any) {
      error(err.message || "Error starting process");
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    setIsSubscribing(planId);
    try {
      const res = await fetch("http://localhost:4000/billing/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ planId })
      });
      
      if (res.ok) {
        const data = await res.json();
        success(
          isRtl ? "تمت ترقية الاشتراك بنجاح!" : "Subscription upgraded successfully!",
          data.message
        );
        fetchBillingDetails();
        refreshUser();
      } else {
        error(isRtl ? "فشلت الترقية. يرجى المحاولة لاحقاً." : "Failed to upgrade. Please try again later.");
      }
    } catch (err) {
      console.error(err);
      error(isRtl ? "خطأ في الاتصال بالخادم." : "Connection error.");
    } finally {
      setIsSubscribing(null);
    }
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
        success(isRtl ? "تم حذف المشروع بنجاح." : "Project deleted successfully.");
        refreshUser();
        fetchBillingDetails();
      }
    } catch (e) {
      console.error(e);
      error(isRtl ? "فشل حذف المشروع." : "Failed to delete project.");
    }
  };

  const renderSkeletons = () => {
    return Array.from({ length: 3 }).map((_, idx) => (
      <div key={idx} className="p-4 border border-zinc-800 bg-zinc-950/20 rounded-2xl space-y-4 animate-shimmer relative overflow-hidden">
        <div className="flex justify-between items-start">
          <div className="w-8 h-8 rounded-lg bg-zinc-800/40" />
          <div className="space-y-2 flex-1 pr-4">
            <div className="w-1/3 h-3.5 bg-zinc-800/40 rounded" />
            <div className="w-1/2 h-2.5 bg-zinc-800/40 rounded" />
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-900/60 pt-3 mt-3">
          <div className="w-1/4 h-2.5 bg-zinc-800/40 rounded" />
          <div className="w-1/6 h-3.5 bg-zinc-800/40 rounded-full" />
        </div>
      </div>
    ));
  };

  // Filtered, sorted, and paginated projects calculation
  const filteredAndSortedProjects = projects
    .filter((proj) => {
      const matchesSearch = searchQuery.trim() === "" || 
        proj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (proj.youtubeUrl && proj.youtubeUrl.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === "ALL" || proj.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "date-desc") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "date-asc") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === "name-asc") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "name-desc") {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === "status") {
        return a.status.localeCompare(b.status);
      }
      return 0;
    });

  const totalItems = filteredAndSortedProjects.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProjects = filteredAndSortedProjects.slice(startIndex, startIndex + itemsPerPage);

  const dashboardTabs = [
    { id: "projects", label: isRtl ? "مشاريعك" : "Projects", icon: <Film className="h-4 w-4" /> },
    { id: "billing", label: isRtl ? "الاشتراكات والرصيد" : "Billing & Credits", icon: <Coins className="h-4 w-4" /> },
  ];

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

          {/* Navigation Subpages Links */}
          <div className="hidden md:flex items-center gap-4 text-[11px] font-bold text-zinc-400 border-l border-white/10 pl-4 ml-2 rtl:border-l-0 rtl:pl-0 rtl:ml-0 rtl:border-r rtl:pr-4 rtl:mr-2">
            <Link href="/dashboard" className="text-white hover:text-white transition-colors">
              {isRtl ? "الرئيسية" : "Dashboard"}
            </Link>
            <Link href="/dashboard/workspace" className="hover:text-white transition-colors">
              {isRtl ? "مساحة العمل" : "Workspace"}
            </Link>
            <Link href="/dashboard/billing" className="hover:text-white transition-colors">
              {isRtl ? "الاشتراكات والرصيد" : "Billing & Credits"}
            </Link>
            <Link href="/dashboard/referrals" className="hover:text-white transition-colors">
              {isRtl ? "الإحالات والكوبونات" : "Referrals & Promo"}
            </Link>
            <Link href="/dashboard/integrations" className="hover:text-white transition-colors">
              {isRtl ? "النشر والمنصات" : "Publishing"}
            </Link>
            <Link href="/dashboard/analytics" className="hover:text-white transition-colors">
              {isRtl ? "التحليلات" : "Analytics"}
            </Link>
            <Link href="/dashboard/developer" className="hover:text-white transition-colors">
              {isRtl ? "المطورين" : "Developer"}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user?.role === "ADMIN" && (
            <Link href="/admin">
              <Button
                variant="secondary"
                size="sm"
                className="font-bold text-zinc-300 flex items-center gap-1.5"
              >
                <ShieldAlert className="h-4 w-4 text-purple-400" />
                <span>{t.common.admin}</span>
              </Button>
            </Link>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={logout}
          >
            {t.common.logout}
          </Button>
        </div>
      </header>

      {/* Stats Cards Section */}
      <section className="max-w-7xl w-full mx-auto px-6 pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 z-10 animate-fade-in">
        <div className="bg-zinc-950/45 border border-white/5 p-4 rounded-2xl space-y-1">
          <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{isRtl ? "إجمالي المشاريع" : "Total Projects"}</span>
          <p className="text-2xl font-black font-mono text-white">{projects.length}</p>
        </div>
        <div className="bg-zinc-950/45 border border-white/5 p-4 rounded-2xl space-y-1">
          <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{isRtl ? "الملفات المرفوعة" : "Video Uploads"}</span>
          <p className="text-2xl font-black font-mono text-white">
            {projects.reduce((acc, p) => acc + (p.videos?.length || 0), 0)}
          </p>
        </div>
        <div className="bg-zinc-950/45 border border-white/5 p-4 rounded-2xl space-y-1">
          <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{isRtl ? "المساحة التخزينية" : "Storage Used"}</span>
          <p className="text-2xl font-black font-mono text-white">
            {(projects.reduce((acc, p) => acc + (p.videos?.reduce((vAcc: number, v: any) => vAcc + (v.bytesSize || 0), 0) || 0), 0) / (1024 * 1024)).toFixed(1)} MB
          </p>
        </div>
        <div className="bg-zinc-950/45 border border-white/5 p-4 rounded-2xl space-y-1">
          <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{isRtl ? "الرصيد المتبقي" : "Remaining Credits"}</span>
          <p className="text-2xl font-black font-mono text-purple-400">{user?.credits ?? 0}</p>
        </div>
      </section>

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
                  <Input
                    label={isRtl ? "اسم المشروع (اختياري):" : "Project Name (Optional):"}
                    placeholder={isRtl ? "مثال: بودكاست ريادة الأعمال #5" : "e.g. Marketing Podcast #5"}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />

                  {/* YouTube link */}
                  <Input
                    label={t.dashboard.youtubeLabel}
                    placeholder={t.dashboard.youtubePlaceholder}
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    icon={<Youtube className="h-4 w-4 text-red-500" />}
                  />

                  {/* Upload Dropzone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300 block">{t.dashboard.uploadLabel}</label>
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
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      className="border border-dashed border-zinc-800 rounded-xl bg-zinc-950/45 p-6 text-center hover:border-purple-500/50 transition-colors cursor-pointer space-y-2"
                    >
                      <Upload className="h-5 w-5 text-zinc-600 mx-auto" />
                      <span className="text-[10px] text-zinc-500 block">{t.dashboard.uploadPlaceholder}</span>
                    </div>
                  </div>

                  {/* Submit Import Button */}
                  <Button
                    type="submit"
                    variant="brand"
                    isLoading={isImporting}
                    className="w-full flex items-center justify-center gap-2 py-3"
                  >
                    <Download className="h-4 w-4" />
                    <span>{isRtl ? "تحميل واستيراد الفيديو" : "Download & Import Video"}</span>
                  </Button>
                </form>
              </div>
            )}

            {importStep === "DOWNLOAD" && (
              <div className="space-y-6 py-8 text-center animate-fade-in">
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
              <div className="space-y-6 animate-fade-in">
                
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
                        <Sparkles className={`h-4.5 w-4.5 ${mode === "AUTO" ? 'text-primary-brand' : 'text-zinc-600'}`} />
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
                        <Wand2 className={`h-4.5 w-4.5 ${mode === "MANUAL" ? 'text-primary-brand' : 'text-zinc-600'}`} />
                        <div className="space-y-0.5">
                          <span className="font-bold text-xs text-white block">{isRtl ? "تقطيع يدوي" : "Manual Clips"}</span>
                          <span className="text-[9px] text-zinc-500 leading-tight block line-clamp-2">{t.dashboard.manualModeDesc}</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Mode Configurations */}
                  {mode === "AUTO" ? (
                    <div className="space-y-3 bg-zinc-950/40 border border-zinc-850/40 p-4 rounded-2xl animate-fade-in">
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
                        className="w-full accent-primary-brand bg-zinc-850 rounded-lg appearance-none h-1.5 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-zinc-600 font-mono">
                        <span>30s</span>
                        <span>60s</span>
                        <span>90s</span>
                        <span>120s</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 bg-zinc-950/40 border border-zinc-850/40 p-4 rounded-2xl animate-fade-in text-right">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-zinc-400 block">{isRtl ? "الفترات الزمنية المستهدفة:" : "Target Ranges:"}</span>
                        {manualClips.length < 10 && (
                          <button
                            type="button"
                            onClick={() => setManualClips([...manualClips, { startTime: "00:00", endTime: "00:30" }])}
                            className="text-[10px] text-purple-400 hover:text-purple-300 font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span className="animate-pulse">+</span>
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
                            className="bg-zinc-950 border border-zinc-850 text-center font-mono text-xs rounded-xl py-2 px-1 flex-1 text-zinc-200 outline-none focus:border-primary-brand"
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
                            className="bg-zinc-950 border border-zinc-850 text-center font-mono text-xs rounded-xl py-2 px-1 flex-1 text-zinc-200 outline-none focus:border-primary-brand"
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
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-1/3"
                      onClick={() => {
                        setImportStep("URL");
                        setImportedProject(null);
                      }}
                    >
                      {isRtl ? "إلغاء" : "Cancel"}
                    </Button>

                    <Button
                      type="submit"
                      variant="primary"
                      className="flex-1"
                      isLoading={isSubmittingProject}
                    >
                      <Wand2 className="h-4 w-4 mr-1" />
                      <span>{isRtl ? "بدء معالجة الكليبات" : "Start AI Processing"}</span>
                    </Button>
                  </div>
                </form>
              </div>
            )}

          </div>
        </div>

        {/* Right column - Projects list & Billing Tab view */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 flex flex-col min-h-[500px]">
            
            <Tabs 
              tabs={dashboardTabs} 
              activeTab={activeTab} 
              onChange={setActiveTab} 
              className="mb-4"
            />

            {activeTab === "projects" && (
              <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-fade-in">
                {/* Search, Filter & Sort Bar */}
                {projects.length > 0 && (
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-zinc-950/45 border border-white/5 p-3 rounded-2xl">
                    {/* Search Input */}
                    <div className="w-full sm:max-w-[220px]">
                      <Input
                        placeholder={isRtl ? "🔍 ابحث باسم المشروع أو الرابط..." : "🔍 Search name or URL..."}
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="h-8.5 text-xs text-right pr-3"
                      />
                    </div>

                    {/* Status Filter buttons/tabs */}
                    <div className="flex flex-wrap gap-1 justify-center">
                      {[
                        { id: "ALL", label: isRtl ? "الكل" : "All" },
                        { id: "COMPLETED", label: isRtl ? "مكتمل" : "Completed" },
                        { id: "PROCESSING", label: isRtl ? "جاري المعالجة" : "Processing" },
                        { id: "FAILED", label: isRtl ? "فاشل" : "Failed" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setStatusFilter(tab.id);
                            setCurrentPage(1);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                            statusFilter === tab.id
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-md"
                              : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Sort Dropdown */}
                    <div>
                      <Dropdown
                        align="left"
                        trigger={
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-[9px] font-bold text-zinc-300 transition-all cursor-pointer">
                            <span>{isRtl ? "ترتيب:" : "Sort:"}</span>
                            <span className="text-purple-400">
                              {sortBy === "date-desc" ? (isRtl ? "الأحدث" : "Newest") :
                               sortBy === "date-asc" ? (isRtl ? "الأقدم" : "Oldest") :
                               sortBy === "name-asc" ? (isRtl ? "الاسم أ-ي" : "Name A-Z") :
                               sortBy === "name-desc" ? (isRtl ? "الاسم ي-أ" : "Name Z-A") :
                               (isRtl ? "الحالة" : "Status")}
                            </span>
                          </button>
                        }
                        items={[
                          { label: isRtl ? "التاريخ: الأحدث" : "Date: Newest", onClick: () => setSortBy("date-desc") },
                          { label: isRtl ? "التاريخ: الأقدم" : "Date: Oldest", onClick: () => setSortBy("date-asc") },
                          { label: isRtl ? "الاسم: أ-ي" : "Name: A-Z", onClick: () => setSortBy("name-asc") },
                          { label: isRtl ? "الاسم: ي-أ" : "Name: Z-A", onClick: () => setSortBy("name-desc") },
                          { label: isRtl ? "الحالة" : "Status", onClick: () => setSortBy("status") },
                        ]}
                      />
                    </div>
                  </div>
                )}

                {/* Projects Listing Container */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {isLoadingProjects ? (
                    renderSkeletons()
                  ) : projects.length === 0 ? (
                    <EmptyState
                      icon={<Film className="h-10 w-10 text-zinc-650" />}
                      title={isRtl ? "لا توجد مشاريع حتى الآن" : "No projects found yet"}
                      description={isRtl ? "ابدأ بإدخال رابط يوتيوب أو رفع فيديو لتشغيل خوارزميات الذكاء الاصطناعي وتقطيع الكليبات." : "Get started by importing a video link or uploading a file to generate viral clips."}
                    />
                  ) : paginatedProjects.length === 0 ? (
                    <EmptyState
                      icon={<Film className="h-10 w-10 text-zinc-650" />}
                      title={isRtl ? "لا توجد نتائج مطابقة" : "No matching projects"}
                      description={isRtl ? "جرب تغيير خيارات البحث أو الفلترة التي حددتها." : "Try changing your search text or filter settings to find what you need."}
                    />
                  ) : (
                    paginatedProjects.map((proj) => {
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
                          className={`p-4 rounded-2xl border transition-all text-right glass-card-hover ${
                            proj.status === "COMPLETED" 
                              ? 'border-zinc-850 bg-zinc-950/45 hover:border-purple-500/40 hover:shadow-[0_0_15px_rgba(139,92,246,0.05)] cursor-pointer' 
                              : proj.status === "DOWNLOADED"
                              ? 'border-purple-900/40 bg-zinc-950/45 hover:border-purple-500/60 cursor-pointer shadow-[0_0_10px_rgba(139,92,246,0.02)]'
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
                                className="text-zinc-550 hover:text-red-400 p-1.5 rounded-lg border border-zinc-900 hover:border-zinc-850 bg-zinc-950/60 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="space-y-1 flex-1 pr-4">
                              <h3 className="font-bold text-xs text-white leading-snug">{proj.name}</h3>
                              <p className="text-[10px] text-zinc-500 max-w-sm truncate dir-ltr">{proj.youtubeUrl || "Local Video Upload"}</p>
                              
                              {/* Display processing status and details */}
                              <div className="flex flex-wrap gap-2 mt-2 justify-end">
                                {proj.status === "PROCESSING" && (
                                  <span className="text-[9px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-md font-bold">
                                    {isRtl ? `المرحلة: ${proj.processingState || 'قيد الانتظار'}` : `State: ${proj.processingState || 'Queued'}`}
                                  </span>
                                )}
                                {proj.status === "COMPLETED" && (
                                  <>
                                    <span className="text-[9px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-md font-bold">
                                      {isRtl ? `كليبات: ${proj.clipGenerationCount ?? proj._count?.clips ?? 0}` : `Clips: ${proj.clipGenerationCount ?? proj._count?.clips ?? 0}`}
                                    </span>
                                    {proj.bestClipScore ? (
                                      <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5">
                                        <Sparkles className="h-2.5 w-2.5" />
                                        {isRtl ? `أفضل تقييم: ${proj.bestClipScore}%` : `Best Score: ${proj.bestClipScore}%`}
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </div>
                              {/* Category tags */}
                              {proj.status === "COMPLETED" && proj.categoriesFound && (
                                <div className="flex flex-wrap gap-1 mt-1.5 justify-end">
                                  {(() => {
                                    try {
                                      const categories = JSON.parse(proj.categoriesFound);
                                      if (Array.isArray(categories)) {
                                        return categories.map((cat: string) => (
                                          <span key={cat} className="text-[8px] bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded-full font-semibold">
                                            #{cat === 'BEST' ? (isRtl ? 'أفضل_المقاطع' : 'Best') :
                                              cat === 'TRENDING' ? (isRtl ? 'التريندات' : 'Trending') :
                                              cat === 'EDUCATIONAL' ? (isRtl ? 'تعليمي' : 'Educational') :
                                              cat === 'STORY' ? (isRtl ? 'قصة' : 'Story') :
                                              cat === 'PODCAST' ? (isRtl ? 'بودكاست' : 'Podcast') :
                                              cat === 'ENGAGEMENT' ? (isRtl ? 'تفاعل_عالي' : 'High_Engagement') : cat}
                                          </span>
                                        ));
                                      }
                                    } catch (e) {}
                                    return null;
                                  })()}
                                </div>
                              )}
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

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className="text-[10px] font-bold py-1 px-3"
                    >
                      {isRtl ? "السابق" : "Previous"}
                    </Button>
                    <span className="text-[10px] text-zinc-500 font-bold font-mono">
                      {isRtl ? `صفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className="text-[10px] font-bold py-1 px-3"
                    >
                      {isRtl ? "التالي" : "Next"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "billing" && (
              <div className="flex-1 space-y-8 animate-fade-in text-right">
                
                {/* Credit balance wallet and subscription status card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-purple-950/20 to-indigo-950/10 border border-purple-500/10 p-5 rounded-2xl space-y-2 flex flex-col justify-between">
                    <span className="text-zinc-400 text-xs font-semibold block">{isRtl ? "رصيد المحفظة الحالي" : "Current Credit Balance"}</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black font-mono text-purple-300">{balanceDetails?.credits ?? user?.credits ?? 0}</span>
                      <span className="text-xs text-zinc-500">{isRtl ? "رصيد" : "Credits"}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-normal">{isRtl ? "يتم خصم الأرصدة تلقائياً بناءً على حجم وطريقة تقطيع الكليبات ومعالجة الترجمات." : "Credits are consumed based on video length, layout reframing, and AI subtitle styles."}</p>
                  </div>

                  <div className="bg-zinc-950/40 border border-zinc-850 p-5 rounded-2xl space-y-2 flex flex-col justify-between">
                    <span className="text-zinc-400 text-xs font-semibold block">{isRtl ? "الباقة الحالية" : "Active Subscription"}</span>
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary-brand/10 text-primary-brand border border-primary-brand/20">
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>{balanceDetails?.subscription?.plan || "FREE"}</span>
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      <span>{isRtl ? "تاريخ التجديد القادم: " : "Renews on: "}</span>
                      <span className="font-mono text-zinc-400">{balanceDetails?.subscription?.currentPeriodEnd ? new Date(balanceDetails.subscription.currentPeriodEnd).toLocaleDateString() : "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Subscriptions upgrade grid */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-zinc-200">{isRtl ? "باقات ترقية الاشتراك المتاحة" : "Available Upgrade Packages"}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {plans.map((plan) => {
                      const isCurrentPlan = balanceDetails?.subscription?.plan === plan.name.toUpperCase().replace(' (PRO)', '').replace(' ', '_');
                      
                      return (
                        <div key={plan.id} className={`p-4 rounded-xl border flex flex-col justify-between gap-4 transition-all relative overflow-hidden ${
                          isCurrentPlan 
                            ? 'border-primary-brand bg-primary-brand/5 shadow-[0_0_15px_rgba(139,92,246,0.08)]' 
                            : 'border-zinc-850 bg-zinc-950/20 hover:bg-zinc-900/30'
                        }`}>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              {isCurrentPlan && (
                                <span className="text-[9px] bg-primary-brand text-white font-bold px-2 py-0.5 rounded-full">{isRtl ? "الخطة الحالية" : "Current Plan"}</span>
                              )}
                              <h4 className="font-extrabold text-xs text-white">{plan.name}</h4>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-black text-zinc-100">${plan.price}</span>
                              <span className="text-[10px] text-zinc-500">/ {isRtl ? "شهرياً" : "month"}</span>
                            </div>
                            <p className="text-[10px] text-purple-300 font-mono font-bold">+{plan.credits} {isRtl ? "رصيد إضافي شهرياً" : "credits per month"}</p>
                            <ul className="space-y-1 pt-2">
                              {plan.features.slice(0, 3).map((f: string, i: number) => (
                                <li key={i} className="text-[10px] text-zinc-400 flex items-center gap-1.5 justify-start rtl:justify-end">
                                  <Check className="h-3 w-3 text-green-400 flex-shrink-0" />
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <Button
                            variant={isCurrentPlan ? "outline" : "primary"}
                            size="sm"
                            disabled={isCurrentPlan || isSubscribing !== null}
                            onClick={() => handleUpgrade(plan.id)}
                            className="w-full text-xs font-semibold py-1.5 mt-2"
                          >
                            {isSubscribing === plan.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : isCurrentPlan ? (
                              isRtl ? "نشط" : "Active"
                            ) : (
                              isRtl ? "ترقية الآن" : "Upgrade Plan"
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Credit wallet transactions log list */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-zinc-200">{isRtl ? "سجل معاملات الرصيد" : "Credit Transaction Logs"}</h3>
                  {transactions.length === 0 ? (
                    <div className="text-center py-10 border border-zinc-900 border-dashed rounded-xl text-xs text-zinc-500">
                      {isRtl ? "لا توجد أي معاملات مسجلة للمحفظة بعد." : "No credit transactions logged yet."}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">{isRtl ? "العملية / الوصف" : "Action / Details"}</TableHead>
                          <TableHead className="text-right">{isRtl ? "النوع" : "Type"}</TableHead>
                          <TableHead className="text-right">{isRtl ? "الرصيد" : "Credits"}</TableHead>
                          <TableHead className="text-right">{isRtl ? "التاريخ" : "Date"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.slice(0, 10).map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-zinc-300 font-medium text-xs">{tx.description}</TableCell>
                            <TableCell>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                tx.type === "SIGNUP_BONUS" ? "bg-green-500/10 text-green-400 border border-green-500/10" :
                                tx.type === "PURCHASE" ? "bg-purple-500/10 text-purple-400 border border-purple-500/10" :
                                tx.type === "CLIP_GENERATION" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/10" :
                                "bg-zinc-800 text-zinc-400"
                              }`}>
                                {tx.type}
                              </span>
                            </TableCell>
                            <TableCell className={`font-mono font-extrabold text-xs ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                              {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                            </TableCell>
                            <TableCell className="text-zinc-500 text-[10px] font-mono">{new Date(tx.createdAt).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

              </div>
            )}

          </div>
        </div>

      </main>

      {/* Floating Processing Stage Overlay Modal */}
      <Modal
        isOpen={!!activeProcessingProjectId}
        onClose={() => {}} // Block manual close to preserve simulation
        title={isRtl ? "جاري معالجة فيديو البودكاست..." : "Processing video workflow..."}
        size="sm"
      >
        <div className="space-y-6 text-center py-4">
          <div className="relative w-20 h-20 mx-auto">
            <Loader2 className="h-20 w-20 animate-spin text-purple-500 absolute inset-0" />
            <div className="absolute inset-2 bg-zinc-950 rounded-full flex items-center justify-center">
              <Wand2 className="h-8 w-8 text-purple-400 animate-pulse" />
            </div>
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-bold text-zinc-200">
              {isRtl 
                ? `المرحلة ${processingStage}/5: استخراج الصوت والتحليل البصري الذكي`
                : `Stage ${processingStage}/5: Extracting audio and running visual AI reframer`}
            </h4>
            <p className="text-[10px] text-zinc-500">{isRtl ? "لا تغلق هذه الصفحة حتى انتهاء المعالجة لضمان صحة الملفات" : "Do not close this page until processing is complete."}</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
              <div style={{ width: `${processingProgress}%` }} className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-300" />
            </div>
            <span className="text-[10px] font-mono text-purple-400 font-extrabold block text-right">{processingProgress}%</span>
          </div>

          {/* Detailed operation logs log list */}
          <div className="bg-zinc-900/60 border border-zinc-850 rounded-2xl p-4 h-28 overflow-y-auto text-right text-[10px] text-zinc-400 font-mono space-y-1.5 scrollbar-thin">
            {processingLogs.map((log, idx) => (
              <div key={idx} className="animate-fade-in">{log}</div>
            ))}
          </div>

          <p className="text-[9px] text-zinc-650">
            * {isRtl ? "تستهلك هذه العملية رصيداً من محفظة Credits الخاصة بك." : "This workflow directly processes credits from your balance wallet."}
          </p>
        </div>
      </Modal>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-zinc-600">
        <p>© 2026 {t.common.appName}. All rights reserved.</p>
      </footer>
    </div>
  );
}
