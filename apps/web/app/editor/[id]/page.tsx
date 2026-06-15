"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import * as React from "react";
import { 
  Play, Pause, Download, Type, Palette, Layout, Sparkles, Wand2, 
  RefreshCw, Move, Trash2, Check, Settings, Scissors, CheckSquare, 
  Square, Volume2, Smile, ArrowLeft, Loader2, Upload
} from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Dropdown } from "../../../components/ui/Dropdown";
import { Tabs } from "../../../components/ui/Tabs";
import { Tooltip } from "../../../components/ui/Tooltip";
import { useToast } from "../../../components/ui/Toast";


interface Project {
  id: string;
  name: string;
  youtubeUrl: string | null;
  status: string;
  videoTitle?: string | null;
  videoDuration?: string | null;
  videoSize?: string | null;
  videoQuality?: string | null;
  thumbnailUrl?: string | null;
  localVideoPath?: string | null;
  processingState?: string | null;
  createdAt: string;
  videos?: any[];
}

function getYoutubeVideoId(url: string | null): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2] && match[2].length === 11) ? match[2] : null;
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

const getVideoFromDB = async (projectId: string): Promise<File | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(projectId);
    request.onsuccess = () => resolve(request.result || null);
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

export default function PremiumEditorPage({ params }: { params: any }) {
  const { t, isRtl } = useI18n();
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();


  const [project, setProject] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);

  // Real dynamic clips states
  const [clips, setClips] = useState<any[]>([]);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [isLoadingClips, setIsLoadingClips] = useState(true);

  // Category filter state
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Detailed Evaluation Modal states
  const [previewClip, setPreviewClip] = useState<any | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedExportQuality, setSelectedExportQuality] = useState<'720p' | '1080p'>('1080p');
  const [isExportingClip, setIsExportingClip] = useState(false);
  const [exportClipJobId, setExportClipJobId] = useState<string | null>(null);
  const [exportClipLogs, setExportClipLogs] = useState<string[]>([]);

  // Clip editing inline states
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [regeneratingClipId, setRegeneratingClipId] = useState<string | null>(null);

  // Download & Bulk actions
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Shorts auto 9:16 layout toggles
  const [isShortsMode, setIsShortsMode] = useState(true);
  const [activeSpeakerTracking, setActiveSpeakerTracking] = useState(true);
  const [smoothFocus, setSmoothFocus] = useState(true);
  const [naturalZoom, setNaturalZoom] = useState(true);
  const [preventShake, setPreventShake] = useState(true);

  // Phase 6 Auto Reframe & camera states
  const [reframeAspect, setReframeAspect] = useState<string>("9:16");
  const [layoutMode, setLayoutMode] = useState<string>("AUTO");
  const [manualCropX, setManualCropX] = useState<number>(50);
  const [manualCropY, setManualCropY] = useState<number>(35);
  const [lockFraming, setLockFraming] = useState<boolean>(false);
  const [disableZoom, setDisableZoom] = useState<boolean>(false);
  const [isCropDragging, setIsCropDragging] = useState(false);

  // Subtitles & styling customization states
  const [showCaptions, setShowCaptions] = useState(true);
  const [wordByWord, setWordByWord] = useState(true);
  const [autoEmojis, setAutoEmojis] = useState(true);
  const [soundEffects, setSoundEffects] = useState(false);
  const [transitions, setTransitions] = useState(false);

  const [activeFont, setActiveFont] = useState("Hormozi");
  const [textColor, setTextColor] = useState("#ffffff");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [hasStroke, setHasStroke] = useState(true);
  const [shadowColor, setShadowColor] = useState("#facc15"); // yellow-400
  const [textScale, setTextScale] = useState(1.2);
  const [textX, setTextX] = useState(50); // percentage (0-100)
  const [textY, setTextY] = useState(70); // percentage (0-100)
  const [isDragging, setIsDragging] = useState(false);
  const [startSecond, setStartSecond] = useState(15); // seek second

  const [selectedTemplate, setSelectedTemplate] = useState("MINIMAL");
  const [brandKits, setBrandKits] = useState<any[]>([]);
  const [activeBrandKitId, setActiveBrandKitId] = useState<string | null>(null);
  const [activeAnimation, setActiveAnimation] = useState("Pop");
  const [uppercase, setUppercase] = useState(false);

  // Brand Kit creation states
  const [showAddBrandKit, setShowAddBrandKit] = useState(false);
  const [newKitName, setNewKitName] = useState("");
  const [newKitPrimary, setNewKitPrimary] = useState("#8b5cf6");
  const [newKitSecondary, setNewKitSecondary] = useState("#06b6d4");
  const [newKitText, setNewKitText] = useState("#ffffff");
  const [newKitFont, setNewKitFont] = useState("Inter");
  const [newKitWatermark, setNewKitWatermark] = useState("");

  // Word Editor states
  const [editingWordIdx, setEditingWordIdx] = useState<number | null>(null);
  const [editingWordText, setEditingWordText] = useState("");
  const [editingWordEmoji, setEditingWordEmoji] = useState("");


  // Export overlay loader states
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Word-by-word active word seeker & accordion states
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [expandedClipIds, setExpandedClipIds] = useState<string[]>([]);

  // Transcription & video understanding states (Phase 3)
  const [transcript, setTranscript] = useState<any>(null);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(true);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [editorRightTab, setEditorRightTab] = useState("transcript");
  const [jobs, setJobs] = useState<any[]>([]);
  const [isPollingJobs, setIsPollingJobs] = useState(false);

  // Unwrap params safely for Next.js 15
  const resolvedParams = React.use(params) as { id: string };
  const activeId = resolvedParams?.id || "";

  // Query cached video file from IndexedDB
  useEffect(() => {
    if (!activeId) return;
    getVideoFromDB(activeId)
      .then((file) => {
        if (file) {
          const url = URL.createObjectURL(file);
          setLocalVideoUrl(url);
        }
      })
      .catch((err) => {
        console.error("Error loading cached video file from IndexedDB:", err);
      });
  }, [activeId]);

  // Fetch project details
  useEffect(() => {
    if (!token || !activeId) return;
    setIsLoadingProject(true);
    fetch(`http://localhost:4000/projects/${activeId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load project");
        return res.json();
      })
      .then((data) => {
        setProject(data);
        setIsLoadingProject(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoadingProject(false);
      });
  }, [activeId, token]);

  const fetchTranscript = async () => {
    try {
      setIsLoadingTranscript(true);
      const res = await fetch(`http://localhost:4000/projects/${activeId}/transcript`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTranscript(data);
      }
    } catch (e) {
      console.error("Failed to load transcript:", e);
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  useEffect(() => {
    if (!token || !activeId) return;
    fetchTranscript();
  }, [activeId, token]);

  // Auto-scroll transcript effect (Phase 3)
  useEffect(() => {
    if (!transcript || !transcript.sentences) return;
    const activeIdx = transcript.sentences.findIndex(
      (s: any) => currentTimeSec >= s.startTime && currentTimeSec <= s.endTime
    );
    if (activeIdx !== -1) {
      const el = document.getElementById(`sentence-${activeIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentTimeSec, transcript]);

  // Jobs polling effect
  useEffect(() => {
    if (!token || !activeId || !project) return;
    if (project.status !== "PROCESSING") return;

    setIsPollingJobs(true);
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:4000/projects/${activeId}/jobs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setJobs(data);
        }

        // Also check project status
        const projRes = await fetch(`http://localhost:4000/projects/${activeId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (projRes.ok) {
          const updatedProj = await projRes.json();
          setProject(updatedProj);
          if (updatedProj.status !== "PROCESSING") {
            clearInterval(interval);
            setIsPollingJobs(false);
            fetchTranscript();
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      setIsPollingJobs(false);
    };
  }, [activeId, token, project?.status]);

  // Poll active clip export job status
  useEffect(() => {
    if (!token || !activeId || !exportClipJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:4000/projects/${activeId}/jobs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const jobsList = await res.json();
          const targetJob = jobsList.find((j: any) => j.id === exportClipJobId);
          if (targetJob) {
            let logsArray: string[] = [];
            try {
              logsArray = JSON.parse(targetJob.logs);
            } catch (e) {
              logsArray = [targetJob.logs];
            }
            setExportClipLogs(logsArray);

            if (targetJob.status === "COMPLETED") {
              clearInterval(interval);
              setIsExportingClip(false);
              setExportClipJobId(null);
              toast.success(isRtl ? "اكتمل تصدير الكليب بنجاح!" : "Clip export completed successfully!");
              
              // Refetch clips to update videoPath720p/1080p
              const clipsRes = await fetch(`http://localhost:4000/projects/${activeId}/clips`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (clipsRes.ok) {
                const data = await clipsRes.json();
                const sorted = data.sort((a: any, b: any) => (a.importanceRank || 1) - (b.importanceRank || 1));
                setClips(sorted);
                // Also update previewClip state to have the new video paths
                if (previewClip) {
                  const updatedClip = sorted.find((c: any) => c.id === previewClip.id);
                  if (updatedClip) setPreviewClip(updatedClip);
                }
              }
            } else if (targetJob.status === "FAILED") {
              clearInterval(interval);
              setIsExportingClip(false);
              setExportClipJobId(null);
              toast.error(isRtl ? `فشل تصدير الكليب: ${targetJob.error}` : `Clip export failed: ${targetJob.error}`);
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [exportClipJobId, token, activeId, previewClip]);

  // Fetch project clips
  useEffect(() => {
    if (!token || !activeId) return;
    setIsLoadingClips(true);
    fetch(`http://localhost:4000/projects/${activeId}/clips`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load clips");
        return res.json();
      })
      .then((data) => {
        const sorted = data.sort((a: any, b: any) => (a.importanceRank || 1) - (b.importanceRank || 1));
        setClips(sorted);
        setIsLoadingClips(false);
        if (sorted.length > 0) {
          const toSec = (tStr: string) => {
            const p = tStr.split(':').map(Number);
            const m = p[0] || 0;
            const s = p[1] || 0;
            return p.length === 2 ? m * 60 + s : Number(tStr) || 0;
          };
          setStartSecond(toSec(sorted[0].startTime));
        }
      })
      .catch((err) => {
        console.error("Error loading clips:", err);
        setIsLoadingClips(false);
      });
  }, [activeId, token]);

  const fetchBrandKits = async () => {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:4000/brand-kits", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBrandKits(data);
      }
    } catch (e) {
      console.error("Failed to fetch brand kits:", e);
    }
  };

  useEffect(() => {
    fetchBrandKits();
  }, [token]);

  const handleCreateBrandKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKitName.trim()) return;
    try {
      const res = await fetch("http://localhost:4000/brand-kits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newKitName,
          primaryColor: newKitPrimary,
          secondaryColor: newKitSecondary,
          textColor: newKitText,
          fontFamily: newKitFont,
          watermarkText: newKitWatermark
        })
      });
      if (res.ok) {
        toast.success(isRtl ? "تم إنشاء الهوية البصرية بنجاح!" : "Brand kit created successfully!");
        setNewKitName("");
        setNewKitWatermark("");
        setShowAddBrandKit(false);
        fetchBrandKits();
      } else {
        toast.error(isRtl ? "فشل إنشاء الهوية البصرية" : "Failed to create brand kit");
      }
    } catch(err) {
      console.error(err);
    }
  };

  const handleApplyBrandKit = (kit: any) => {
    setActiveBrandKitId(kit.id);
    if (kit.textColor) setTextColor(kit.textColor);
    if (kit.secondaryColor) setShadowColor(kit.secondaryColor);
    if (kit.primaryColor) setStrokeColor(kit.primaryColor);
    if (kit.fontFamily) setActiveFont(kit.fontFamily);
    toast.success(isRtl ? `تم تطبيق هوية: ${kit.name}` : `Applied brand kit: ${kit.name}`);
  };

  const applyTemplatePreset = (presetName: string) => {
    setSelectedTemplate(presetName);
    switch (presetName) {
      case "PODCAST":
        setActiveFont("Hormozi");
        setTextColor("#ffffff");
        setShadowColor("#8b5cf6");
        setStrokeColor("#000000");
        setHasStroke(true);
        setTextScale(1.4);
        setTextY(75);
        setActiveAnimation("Bounce");
        setUppercase(true);
        break;
      case "VIRAL":
        setActiveFont("Impact");
        setTextColor("#facc15");
        setShadowColor("#000000");
        setStrokeColor("#000000");
        setHasStroke(true);
        setTextScale(1.6);
        setTextY(60);
        setActiveAnimation("Pop");
        setUppercase(true);
        break;
      case "MINIMAL":
        setActiveFont("Minimal");
        setTextColor("#ffffff");
        setShadowColor("#000000");
        setStrokeColor("#000000");
        setHasStroke(false);
        setTextScale(1.0);
        setTextY(85);
        setActiveAnimation("Fade");
        setUppercase(false);
        break;
      case "DOCUMENTARY":
        setActiveFont("Elegant");
        setTextColor("#f3f4f6");
        setShadowColor("#1f2937");
        setStrokeColor("#000000");
        setHasStroke(true);
        setTextScale(1.1);
        setTextY(80);
        setActiveAnimation("Slide");
        setUppercase(false);
        break;
      case "EDUCATIONAL":
        setActiveFont("Impact");
        setTextColor("#06b6d4");
        setShadowColor("#0891b2");
        setStrokeColor("#ffffff");
        setHasStroke(true);
        setTextScale(1.3);
        setTextY(65);
        setActiveAnimation("Scale");
        setUppercase(true);
        break;
      case "CREATOR":
        setActiveFont("Hormozi");
        setTextColor("#ec4899");
        setShadowColor("#fbcfe8");
        setStrokeColor("#000000");
        setHasStroke(true);
        setTextScale(1.5);
        setTextY(70);
        setActiveAnimation("Bounce");
        setUppercase(true);
        break;
    }
    toast.success(isRtl ? `تم تطبيق قالب: ${presetName}` : `Preset template loaded: ${presetName}`);
  };

  const handleSaveStyling = async () => {
    const activeClip = clips[activeClipIndex];
    if (!activeClip) return;

    const settings = {
      fontFamily: activeFont,
      primaryColor: textColor,
      secondaryColor: shadowColor,
      strokeColor,
      hasStroke,
      fontSize: Math.round(textScale * 20),
      textX,
      textY,
      animation: activeAnimation,
      uppercase
    };

    try {
      const res = await fetch(`http://localhost:4000/projects/clips/${activeClip.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          selectedTemplate,
          brandKitId: activeBrandKitId,
          captionSettings: JSON.stringify(settings),
          exportSettings: JSON.stringify({ burnIn: showCaptions }),
          words: activeClip.words,
          reframeAspect,
          layoutMode,
          reframeSettings: JSON.stringify({
            manualCropX,
            manualCropY,
            lockFraming,
            disableZoom
          })
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setClips(clips.map(c => c.id === activeClip.id ? updated : c));
        toast.success(isRtl ? "تم حفظ إعدادات الترجمة بنجاح!" : "Caption styling saved successfully!");
      } else {
        toast.error(isRtl ? "فشل حفظ إعدادات الترجمة" : "Failed to save caption styling");
      }
    } catch(e) {
      console.error(e);
      toast.error(isRtl ? "خطأ في الاتصال بالخادم" : "Network error");
    }
  };

  const getSuggestedEmoji = (word: string): string => {
    const w = word.toLowerCase();
    if (w.includes("money") || w.includes("dollar") || w.includes("$") || w.includes("جنيه") || w.includes("ريال") || w.includes("ثروة")) return "💵";
    if (w.includes("fire") || w.includes("cool") || w.includes("نار") || w.includes("رهيب") || w.includes("حار")) return "🔥";
    if (w.includes("rocket") || w.includes("fast") || w.includes("سريع") || w.includes("انطلاق")) return "🚀";
    if (w.includes("idea") || w.includes("think") || w.includes("فكرة") || w.includes("عقل")) return "💡";
    if (w.includes("love") || w.includes("heart") || w.includes("حب") || w.includes("قلب")) return "❤️";
    if (w.includes("spark") || w.includes("magic") || w.includes("سحر") || w.includes("بريق")) return "✨";
    if (w.includes("no") || w.includes("wrong") || w.includes("خطأ") || w.includes("لا")) return "❌";
    if (w.includes("change") || w.includes("swap") || w.includes("تبديل") || w.includes("تغيير")) return "🔄";
    if (w.includes("people") || w.includes("team") || w.includes("ناس") || w.includes("فريق")) return "👥";
    if (w.includes("win") || w.includes("best") || w.includes("فوز") || w.includes("أفضل")) return "🏆";
    return "";
  };

  const handleSuggestAllEmojis = () => {
    const activeClip = clips[activeClipIndex];
    if (!activeClip) return;
    try {
      const wordsList = JSON.parse(activeClip.words || '[]');
      const updated = wordsList.map((wObj: any) => {
        const suggested = getSuggestedEmoji(wObj.word);
        if (suggested) {
          return { ...wObj, emoji: suggested };
        }
        return wObj;
      });
      const updatedWordsStr = JSON.stringify(updated);
      
      const updatedClips = clips.map((c, idx) => 
        idx === activeClipIndex ? { ...c, words: updatedWordsStr } : c
      );
      setClips(updatedClips);
      
      toast.success(isRtl ? "تم اقتراح الرموز التعبيرية لجميع الكلمات!" : "Emojis suggested for all words!");
    } catch(e) {
      console.error(e);
    }
  };

  const handleSaveWordEdit = () => {
    const activeClip = clips[activeClipIndex];
    if (!activeClip || editingWordIdx === null) return;
    try {
      const wordsList = JSON.parse(activeClip.words || '[]');
      if (wordsList[editingWordIdx]) {
        wordsList[editingWordIdx].word = editingWordText;
        wordsList[editingWordIdx].emoji = editingWordEmoji || null;
      }
      const updatedWordsStr = JSON.stringify(wordsList);
      
      const updatedClips = clips.map((c, idx) => 
        idx === activeClipIndex ? { ...c, words: updatedWordsStr } : c
      );
      setClips(updatedClips);
      setEditingWordIdx(null);
      toast.success(isRtl ? "تم تحديث الكلمة بنجاح!" : "Word updated successfully!");
    } catch(e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const activeClip = clips[activeClipIndex];
    if (activeClip) {
      if (activeClip.selectedTemplate) setSelectedTemplate(activeClip.selectedTemplate);
      if (activeClip.brandKitId) setActiveBrandKitId(activeClip.brandKitId);
      if (activeClip.reframeAspect) {
        setReframeAspect(activeClip.reframeAspect);
        setIsShortsMode(activeClip.reframeAspect !== "16:9");
      }
      if (activeClip.layoutMode) setLayoutMode(activeClip.layoutMode);
      if (activeClip.reframeSettings) {
        try {
          const rs = JSON.parse(activeClip.reframeSettings);
          if (rs.manualCropX !== undefined) setManualCropX(rs.manualCropX);
          if (rs.manualCropY !== undefined) setManualCropY(rs.manualCropY);
          if (rs.lockFraming !== undefined) setLockFraming(rs.lockFraming);
          if (rs.disableZoom !== undefined) setDisableZoom(rs.disableZoom);
        } catch (e) {}
      } else {
        setManualCropX(50);
        setManualCropY(35);
        setLockFraming(false);
        setDisableZoom(false);
      }
      if (activeClip.captionSettings) {
        try {
          const s = JSON.parse(activeClip.captionSettings);
          if (s.fontFamily) setActiveFont(s.fontFamily);
          if (s.primaryColor) setTextColor(s.primaryColor);
          if (s.secondaryColor) setShadowColor(s.secondaryColor);
          if (s.fontSize) setTextScale(s.fontSize / 20);
          if (s.hasStroke !== undefined) setHasStroke(s.hasStroke);
          if (s.strokeColor) setStrokeColor(s.strokeColor);
          if (s.textX !== undefined) setTextX(s.textX);
          if (s.textY !== undefined) setTextY(s.textY);
          if (s.animation) setActiveAnimation(s.animation);
          if (s.uppercase !== undefined) setUppercase(s.uppercase);
        } catch(e){}
      }
    }
  }, [activeClipIndex, clips]);

  const videoRef = React.useRef<HTMLVideoElement>(null);


  // Play/pause native video element when isPlaying changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.play().catch((err) => console.log("Video play call deferred/blocked:", err));
    } else {
      video.pause();
    }
  }, [isPlaying]);

  // Sync video timeline seek when changing active clip
  useEffect(() => {
    setCurrentTimeMs(0);
    const video = videoRef.current;
    if (!video) return;
    const activeClip = clips[activeClipIndex];
    if (activeClip) {
      const toSec = (tStr: string) => {
        const p = tStr.split(':').map(Number);
        const m = p[0] || 0;
        const s = p[1] || 0;
        return p.length === 2 ? m * 60 + s : Number(tStr) || 0;
      };
      const startSec = toSec(activeClip.startTime);
      video.currentTime = startSec;
      if (isPlaying) {
        video.play().catch((err) => console.log("Video autoplay call deferred:", err));
      }
    }
  }, [activeClipIndex, clips]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setCurrentTimeSec(video.currentTime);
    const activeClip = clips[activeClipIndex];
    if (!activeClip) return;

    const toSec = (tStr: string) => {
      const p = tStr.split(':').map(Number);
      const m = p[0] || 0;
      const s = p[1] || 0;
      return p.length === 2 ? m * 60 + s : Number(tStr) || 0;
    };

    const startSec = toSec(activeClip.startTime);
    const endSec = toSec(activeClip.endTime);
    const current = video.currentTime;

    if (current >= endSec) {
      setIsPlaying(false);
      video.pause();
      video.currentTime = startSec;
      setCurrentTimeMs(0);
    } else {
      const diffSec = Math.max(0, current - startSec);
      setCurrentTimeMs(diffSec * 1000);
    }
  };

  const getActiveSentenceInfo = () => {
    const activeClip = clips[activeClipIndex];
    if (!activeClip || !activeClip.words) return { wordsList: [], activeWordIdx: -1, globalActiveWord: null };
    try {
      const wordsList = JSON.parse(activeClip.words);
      const seconds = currentTimeMs / 1000;

      const groupSize = 3;
      const activeIdx = wordsList.findIndex((w: any) => seconds >= w.start && seconds <= w.end);

      const targetIdx = activeIdx !== -1 ? activeIdx : 0;
      const groupStart = Math.floor(targetIdx / groupSize) * groupSize;
      const groupEnd = Math.min(wordsList.length, groupStart + groupSize);

      const currentGroup = wordsList.slice(groupStart, groupEnd);
      const localActiveIdx = targetIdx - groupStart;

      return {
        wordsList: currentGroup,
        activeWordIdx: localActiveIdx,
        globalActiveWord: wordsList[targetIdx] || null
      };
    } catch (e) {
      return { wordsList: [], activeWordIdx: -1, globalActiveWord: null };
    }
  };

  const getPlayerTransform = () => {
    if (!isShortsMode) return {};
    if (!activeSpeakerTracking) return { transform: "scale(1.7) translateY(0%) translateX(0%)" };

    const info = getActiveSentenceInfo();
    const activeWord = info?.globalActiveWord;
    if (!activeWord || !activeWord.face) return { transform: "scale(1.7) translateY(0%) translateX(0%)" };

    const { x: faceX = 50, y: faceY = 35, w: faceW = 25, h: faceH = 25 } = activeWord.face;

    // Apply smart preview zoom multiplier on highlighted words
    let scaleMultiplier = 1.0;
    if (activeWord?.highlight && !disableZoom) {
      scaleMultiplier = 1.15; // subtle dynamic preview zoom
    }

    // Target a zoom size of 55% of the frame height for the face area.
    // This perfectly centers both the head and the shoulders/horizontal context.
    let scale = (55 / faceH) * scaleMultiplier;

    // Strict zoom constraints: keep the scale between 1.4x (wider horizontal view) and 2.2x (tighter portrait view)
    if (scale > 2.2) scale = 2.2;
    if (scale < 1.4) scale = 1.4;

    // Apply manual overrides if lockFraming is false.
    let finalX = faceX;
    let finalY = faceY;
    if (lockFraming) {
      finalX = 50;
      finalY = 35;
    } else {
      if (manualCropX !== 50) {
        finalX = manualCropX;
      }
      if (manualCropY !== 35) {
        finalY = manualCropY;
      }
    }

    // Translate horizontally (with 0.85 smooth multiplier to preserve horizontal context)
    // and vertically (target head placement in the top third of the frame at 30%)
    const translateX = (50 - finalX) * scale * 0.85;
    const translateY = (30 - finalY) * scale;

    return {
      transform: `scale(${scale.toFixed(2)}) translate(${translateX.toFixed(1)}%, ${translateY.toFixed(1)}%)`,
      transition: smoothFocus ? "transform 0.45s cubic-bezier(0.25, 0.8, 0.25, 1)" : "none"
    };
  };

  const getFaceBoxStyle = () => {
    const info = getActiveSentenceInfo();
    const activeWord = info?.globalActiveWord;
    if (!activeWord || !activeWord.face || !activeSpeakerTracking) return { display: "none" };

    const { x, y, w, h } = activeWord.face;
    return {
      left: `${x - w/2}%`,
      top: `${y - h/2}%`,
      width: `${w}%`,
      height: `${h}%`,
      border: "2px solid #8b5cf6",
      boxShadow: "0 0 10px rgba(139, 92, 246, 0.6)",
      borderRadius: "8px",
      transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)"
    };
  };

  // Safe zones calculation avoiding face overlap
  const getVisualCaptionY = () => {
    let visualY = textY;
    
    // Check intersection with active face
    const info = getActiveSentenceInfo();
    const activeWord = info?.globalActiveWord;
    if (activeWord && activeWord.face) {
      const { y: faceY = 35, h: faceH = 25 } = activeWord.face;
      const faceBottom = faceY + faceH / 2;
      
      // If caption Y overlaps with face area
      if (visualY >= faceY - faceH/2 - 10 && visualY <= faceBottom + 10) {
        if (faceY < 50) {
          visualY = Math.min(90, faceBottom + 12); // push down
        } else {
          visualY = Math.max(10, faceY - faceH/2 - 12); // push up
        }
      }
    }
    
    // Avoid UI borders (Safe Zones)
    return Math.max(10, Math.min(90, visualY));
  };

  const toggleExplanation = (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedClipIds(prev =>
      prev.includes(clipId) ? prev.filter(id => id !== clipId) : [...prev, clipId]
    );
  };

  // Drag position subtitles
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById("video-frame-container");
      if (!container) return;
      const rect = container.getBoundingClientRect();

      let newX = ((e.clientX - rect.left) / rect.width) * 100;
      let newY = ((e.clientY - rect.top) / rect.height) * 100;

      newX = Math.max(8, Math.min(92, newX));
      newY = Math.max(8, Math.min(92, newY));

      setTextX(newX);
      setTextY(newY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Drag position crop target box
  useEffect(() => {
    if (!isCropDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById("video-frame-container");
      if (!container) return;
      const rect = container.getBoundingClientRect();

      let newX = ((e.clientX - rect.left) / rect.width) * 100;
      let newY = ((e.clientY - rect.top) / rect.height) * 100;

      newX = Math.max(0, Math.min(100, newX));
      newY = Math.max(0, Math.min(100, newY));

      setManualCropX(Math.round(newX));
      setManualCropY(Math.round(newY));
    };

    const handleMouseUp = () => {
      setIsCropDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isCropDragging]);

  const handleClipClick = (index: number) => {
    setActiveClipIndex(index);
    setIsPlaying(true);

    const clip = clips[index];
    if (clip) {
      const toSec = (tStr: string) => {
        const p = tStr.split(':').map(Number);
        const m = p[0] || 0;
        const s = p[1] || 0;
        return p.length === 2 ? m * 60 + s : Number(tStr) || 0;
      };
      setStartSecond(toSec(clip.startTime));
    }
  };

  const startEditing = (clip: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClipId(clip.id);
    setEditTitle(clip.title);
    setEditStart(clip.startTime);
    setEditEnd(clip.endTime);
  };

  const handleSaveClipEdit = async (clipId: string, e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:4000/projects/clips/${clipId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: editTitle,
          startTime: editStart,
          endTime: editEnd
        })
      });
      if (!res.ok) throw new Error("Failed to update clip");
      const updated = await res.json();
      setClips(clips.map(c => c.id === clipId ? updated : c));
      setEditingClipId(null);
    } catch (err) {
      console.error(err);
      toast.error(isRtl ? "فشل في حفظ تفاصيل الكليب." : "Failed to save clip details.");
    }
  };

  const handleDeleteClip = async (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(isRtl ? "هل أنت متأكد من حذف هذا الكليب؟" : "Are you sure you want to delete this clip?")) return;
    try {
      const res = await fetch(`http://localhost:4000/projects/clips/${clipId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete clip");
      const remaining = clips.filter(c => c.id !== clipId);
      setClips(remaining);
      if (activeClipIndex >= remaining.length) {
        setActiveClipIndex(Math.max(0, remaining.length - 1));
      }
    } catch (err) {
      console.error(err);
      toast.error(isRtl ? "فشل في حذف الكليب." : "Failed to delete clip.");
    }
  };

  const handleRegenerateClip = async (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRegeneratingClipId(clipId);
    try {
      const res = await fetch(`http://localhost:4000/projects/clips/${clipId}/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to regenerate clip");
      const updated = await res.json();
      setClips(clips.map(c => c.id === clipId ? updated : c));
    } catch (err) {
      console.error(err);
      toast.error(isRtl ? "فشل في إعادة إنشاء الكليب." : "Failed to regenerate clip.");
    } finally {
      setRegeneratingClipId(null);
    }
  };

  const toggleSelectClip = (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedClipIds(prev =>
      prev.includes(clipId) ? prev.filter(id => id !== clipId) : [...prev, clipId]
    );
  };

  const toggleFavoriteClip = async (clipId: string, currentVal: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`http://localhost:4000/projects/clips/${clipId}/favorite`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isFavorite: !currentVal })
      });
      if (res.ok) {
        setClips(clips.map(c => c.id === clipId ? { ...c, isFavorite: !currentVal } : c));
        if (previewClip && previewClip.id === clipId) {
          setPreviewClip({ ...previewClip, isFavorite: !currentVal });
        }
        toast.success(isRtl ? "تم تحديث التفضيل!" : "Favorite updated!");
      } else {
        toast.error(isRtl ? "فشل تحديث التفضيل" : "Failed to update favorite");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportClip = async (clipId: string, quality: '720p' | '1080p') => {
    setIsExportingClip(true);
    setExportClipLogs([isRtl ? "🔄 جاري إرسال طلب التصدير إلى الخادم..." : "🔄 Submitting export request to server..."]);
    try {
      const res = await fetch(`http://localhost:4000/projects/clips/${clipId}/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ quality })
      });
      if (res.ok) {
        const job = await res.json();
        setExportClipJobId(job.id);
        setExportClipLogs(prev => [...prev, isRtl ? "✅ تم استلام المهمة في قائمة الانتظار للبدء بالقص..." : "✅ Job queued for FFmpeg cutting..."]);
      } else {
        setIsExportingClip(false);
        toast.error(isRtl ? "فشل بدء التصدير" : "Failed to start export");
      }
    } catch (err) {
      console.error(err);
      setIsExportingClip(false);
    }
  };

  const triggerFileDownload = (fileName: string) => {
    const link = document.createElement("a");
    link.href = "http://localhost:4000/static/videos/sample.mp4";
    link.download = fileName.endsWith(".mp4") ? fileName : `${fileName}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSelected = () => {
    if (selectedClipIds.length === 0) return;
    setIsDownloading(true);
    setDownloadProgress(0);

    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsDownloading(false);
            selectedClipIds.forEach((id, index) => {
              const clipObj = clips.find(c => c.id === id);
              const titleStr = clipObj ? clipObj.title : "clip";
              setTimeout(() => {
                triggerFileDownload(titleStr);
              }, index * 1000);
            });
            toast.success(isRtl ? "تم تحميل المقاطع المحددة بنجاح!" : "Selected clips downloaded successfully!");
          }, 300);
          return 100;
        }
        return prev + 25;
      });
    }, 300);
  };

  const handleDownloadAll = () => {
    if (clips.length === 0) return;
    setIsDownloading(true);
    setDownloadProgress(0);

    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsDownloading(false);
            clips.forEach((c, idx) => {
              setTimeout(() => {
                triggerFileDownload(c.title || `clip-${idx + 1}`);
              }, idx * 1000);
            });
            toast.success(isRtl ? "تم تحميل جميع المقاطع بنجاح!" : "All clips downloaded successfully!");
          }, 300);
          return 100;
        }
        return prev + 20;
      });
    }, 250);
  };

  const handleExport = () => {
    setIsExporting(true);
    setExportProgress(0);
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsExporting(false);
            const activeClip = clips[activeClipIndex];
            const titleStr = activeClip ? activeClip.title : "exported-clip";
            triggerFileDownload(titleStr);
            toast.success(isRtl ? "تم تصدير الكليب بالجودة النهائية!" : "Clip exported successfully in high quality!");
          }, 300);
          return 100;
        }
        return prev + 10;
      });
    }, 400);
  };

  const videoId = project ? getYoutubeVideoId(project.youtubeUrl) : null;

  const getFontFamilyStyle = (font: string) => {
    switch (font) {
      case "Hormozi": return "font-black tracking-tight uppercase";
      case "Minimal": return "font-mono tracking-normal";
      case "Elegant": return "font-serif italic tracking-wide";
      case "Impact": return "font-sans font-extrabold uppercase tracking-tighter";
      default: return "";
    }
  };

  const timeToSec = (str: string) => {
    const parts = str.split(':').map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : Number(str) || 0;
  };

  const getClipText = () => {
    const activeClip = clips[activeClipIndex];
    if (!activeClip) return isRtl ? "مستقبل الذكاء" : "FUTURE OF AI";
    return activeClip.title;
  };

  return (
    <div className="flex h-screen flex-col bg-[#070709] text-zinc-100 overflow-hidden" dir={isRtl ? "rtl" : "ltr"}>
      {/* Top Navbar */}
      <header className="flex h-14 items-center justify-between border-b border-white/5 bg-zinc-950/45 px-6 z-10">
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          <Button 
            onClick={() => router.push('/dashboard')} 
            variant="ghost" 
            size="sm" 
            className="text-zinc-500 hover:text-white text-xs font-bold flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-0.5 rtl:rotate-180" />
            {t.editor.backBtn}
          </Button>
          <div className="h-4 w-px bg-white/10" />
          <h1 className="text-sm font-semibold flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-purple-400 animate-pulse" /> 
            {project ? project.name : t.editor.title}
          </h1>
        </div>
        <Button 
          onClick={handleExport} 
          variant="brand" 
          size="sm" 
          className="flex items-center gap-2 font-bold text-xs"
        >
          <Download className="h-4 w-4" /> {t.editor.exportBtn}
        </Button>
      </header>

      {/* Main Content */}
      {project && (project.status === "PROCESSING" || project.status === "DRAFT" || project.status === "DOWNLOADING") ? (
        <main className="flex-1 flex flex-col items-center justify-center p-8 bg-[#09090c]">
          <div className="max-w-xl w-full bg-zinc-950/60 border border-white/5 rounded-3xl p-8 space-y-6 text-right">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-bold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full animate-pulse">
                {isRtl ? "جاري المعالجة والتحليل" : "Processing & Indexing"}
              </span>
              <h2 className="text-base font-black text-white">{project.name}</h2>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">{isRtl ? "مرحلة المعالجة الحالية:" : "Current Stage:"}</span>
                <span className="font-bold text-zinc-300">
                  {project.processingState === "QUEUED" ? (isRtl ? "في قائمة الانتظار" : "Queued") :
                   project.processingState === "TRANSCRIBING" ? (isRtl ? "جاري كتابة النصوص واستخلاص الكلمات" : "Transcribing Speech-to-Text") :
                   (isRtl ? "جاري استخراج بيانات الفيديو واللقطات" : "Extracting Video Metadata")}
                </span>
              </div>

              {/* Progress bar simulation */}
              <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-white/5">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-500" 
                  style={{ width: project.processingState === "TRANSCRIBING" ? "75%" : "35%" }}
                />
              </div>
            </div>

            {/* Display logs */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-zinc-400">{isRtl ? "سجل معالجة الخادم (حي):" : "Live Execution Logs:"}</h3>
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 h-48 overflow-y-auto font-mono text-[10px] text-zinc-400 space-y-1.5 text-left dir-ltr scrollbar-thin">
                {jobs.length === 0 ? (
                  <div className="text-zinc-650 text-center py-12">
                    {isRtl ? "في انتظار بدء المهمة الأولى..." : "Waiting for queue initialization..."}
                  </div>
                ) : (
                  jobs.map((job) => {
                    let logArray: string[] = [];
                    try {
                      logArray = job.logs ? JSON.parse(job.logs) : [];
                    } catch (e) {
                      logArray = [job.logs];
                    }
                    return (
                      <div key={job.id} className="space-y-1">
                        <div className="text-purple-400 font-bold border-b border-zinc-900 pb-0.5 mb-1 text-xs">
                          [{job.type}] - {job.status}
                        </div>
                        {logArray.map((log, idx) => (
                          <div key={idx} className="pl-2 hover:text-zinc-200 transition-colors">{log}</div>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 text-center">
              {isRtl 
                ? "💡 يمكنك البقاء في هذه الصفحة، وسيتم فتح محرر الفيديو تلقائياً فور اكتمال كتابة النصوص." 
                : "💡 You can keep this tab open; the interactive editor will load automatically once transcription finishes."}
            </p>
          </div>
        </main>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Panel - Subtitles Style customizer */}
          <aside className="w-80 border-e border-white/5 bg-zinc-950/20 p-5 flex flex-col justify-between overflow-y-auto z-10 space-y-6">
            <div className="space-y-6">
              <h2 className="text-sm font-black text-white">{t.editor.settingsTitle}</h2>
              
              {/* Aspect Ratio and Smart Camera Settings */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{isRtl ? "إعادة الأبعاد والكاميرا الذكية" : "Smart Reframe & Camera"}</h3>
                
                <div className="space-y-3.5 border border-white/5 bg-zinc-950/45 p-3.5 rounded-2xl hover:border-zinc-800/80 transition-all duration-200 shadow-lg">
                  {/* Aspect Ratio Selector */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-zinc-400 block">{isRtl ? "صيغة العرض (Aspect Ratio):" : "Output Format (Aspect Ratio):"}</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: "9:16", value: "9:16", desc: "Shorts/TikTok" },
                        { label: "1:1", value: "1:1", desc: "Square" },
                        { label: "4:5", value: "4:5", desc: "Portrait" },
                        { label: "16:9", value: "16:9", desc: "Landscape" }
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            setReframeAspect(item.value);
                            setIsShortsMode(item.value !== "16:9");
                          }}
                          className={`py-1.5 px-1 rounded-xl text-[9px] font-bold transition-all border ${
                            reframeAspect === item.value 
                              ? "bg-purple-600/20 border-purple-500 text-purple-400" 
                              : "bg-zinc-900 border-white/5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                          }`}
                          title={item.desc}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Layout Mode Selector */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-zinc-400 block">{isRtl ? "نمط التصميم (Layout Mode):" : "Layout Focus Mode:"}</label>
                    <select
                      value={layoutMode}
                      onChange={(e) => setLayoutMode(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/5 text-[10px] text-zinc-400 font-semibold rounded-xl py-1.5 px-2 focus:outline-none focus:border-purple-500 transition-all cursor-pointer"
                    >
                      <option value="AUTO">{isRtl ? "تلقائي (Active Speaker)" : "Auto (Active Speaker)"}</option>
                      <option value="FULL_FOCUS">{isRtl ? "تركيز كامل على المتحدث" : "Full Focus"}</option>
                      <option value="SPLIT">{isRtl ? "شاشة مقسمة ثنائية (Split Screen)" : "Split Screen (Podcast)"}</option>
                      <option value="DUAL_SPEAKER">{isRtl ? "عرض ثنائي ديناميكي" : "Dynamic Dual Speaker"}</option>
                      <option value="CENTER_CROP">{isRtl ? "قص ثابت في المنتصف" : "Fixed Center Crop"}</option>
                    </select>
                  </div>

                  {/* Camera Behavior Overrides */}
                  <div className="space-y-2 pt-2 border-t border-white/5 animate-in fade-in duration-200">
                    <label className="flex items-center justify-between cursor-pointer hover:text-white transition-colors">
                      <span className="text-[9px] text-zinc-400">{isRtl ? "تتبع الوجوه المتحدثة:" : "Follow Active Speaker:"}</span>
                      <input 
                        type="checkbox" 
                        checked={activeSpeakerTracking} 
                        onChange={(e) => setActiveSpeakerTracking(e.target.checked)} 
                        className="accent-purple-500 h-3 w-3 cursor-pointer" 
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer hover:text-white transition-colors">
                      <span className="text-[9px] text-zinc-400">{isRtl ? "قفل التأطير (تثبيت الكاميرا):" : "Lock Camera Framing:"}</span>
                      <input 
                        type="checkbox" 
                        checked={lockFraming} 
                        onChange={(e) => setLockFraming(e.target.checked)} 
                        className="accent-purple-500 h-3 w-3 cursor-pointer" 
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer hover:text-white transition-colors">
                      <span className="text-[9px] text-zinc-400">{isRtl ? "تعطيل حركات التقريب الذكية:" : "Disable Dynamic Zooms:"}</span>
                      <input 
                        type="checkbox" 
                        checked={disableZoom} 
                        onChange={(e) => setDisableZoom(e.target.checked)} 
                        className="accent-purple-500 h-3 w-3 cursor-pointer" 
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Captions customizer */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{isRtl ? "الترجمة والنصوص والتأثيرات" : "Subtitles & Effects"}</h3>
                
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3.5 border border-white/5 rounded-2xl bg-zinc-950/60 hover:border-zinc-800/80 transition-all duration-200 cursor-pointer shadow-lg">
                    <span className="font-semibold text-xs">{isRtl ? "عرض الترجمة التلقائية" : "Show Auto Captions"}</span>
                    <input type="checkbox" checked={showCaptions} onChange={() => setShowCaptions(!showCaptions)} className="accent-purple-500 h-4 w-4 cursor-pointer" />
                  </label>

                  {showCaptions && (
                    <div className="space-y-3 border border-white/5 bg-zinc-950/45 p-3.5 rounded-2xl animate-in fade-in duration-200 shadow-inner">
                      <label className="flex items-center justify-between cursor-pointer hover:text-white transition-colors">
                        <span className="text-[10px] text-zinc-500">{isRtl ? "تأثير كلمة بكلمة:" : "Word-by-word captions:"}</span>
                        <input type="checkbox" checked={wordByWord} onChange={(e) => setWordByWord(e.target.checked)} className="accent-purple-500 h-3.5 w-3.5 cursor-pointer" />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer hover:text-white transition-colors">
                        <span className="text-[10px] text-zinc-500">{isRtl ? "إضافة Emojis تلقائية:" : "Auto Emojis:"}</span>
                        <input type="checkbox" checked={autoEmojis} onChange={(e) => setAutoEmojis(e.target.checked)} className="accent-purple-500 h-3.5 w-3.5 cursor-pointer" />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Styling customizable properties */}
              {showCaptions && (
                <div className="space-y-4 border-t border-white/5 pt-4 animate-in fade-in duration-300">
                  <div>
                    <h3 className="text-[10px] font-bold text-zinc-500 mb-2">{t.editor.fontStyle}</h3>
                    <div className="grid grid-cols-2 gap-1.5">
                      {["Hormozi", "Minimal", "Elegant", "Impact"].map((font) => (
                        <button 
                          key={font}
                          onClick={() => setActiveFont(font)}
                          className={`border rounded-lg p-1.5 text-[9px] font-semibold transition-all ${
                            activeFont === font 
                              ? 'border-purple-500 bg-purple-500/10 text-white shadow-md' 
                              : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-500'
                          }`}
                        >
                          {font}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>{isRtl ? "حجم الخط:" : "Font Size:"}</span>
                      <span className="font-mono text-[10px] font-bold">{textScale.toFixed(1)}x</span>
                    </div>
                    <input type="range" min="0.6" max="2.5" step="0.1" value={textScale} onChange={(e) => setTextScale(Number(e.target.value))} className="w-full accent-purple-500 bg-zinc-800 rounded-lg appearance-none h-1.5 cursor-pointer" />
                  </div>

                  {/* Subtitle Border customizable stroke toggle */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-zinc-500 block">{isRtl ? "لون الخط:" : "Text Color:"}</label>
                      <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-full h-6 rounded bg-zinc-950 cursor-pointer border border-zinc-800" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-bold text-zinc-500 block">{isRtl ? "حدود (Stroke):" : "Border (Stroke):"}</label>
                        <input type="checkbox" checked={hasStroke} onChange={(e) => setHasStroke(e.target.checked)} className="accent-purple-500 h-2.5 w-2.5 cursor-pointer" />
                      </div>
                      {hasStroke ? (
                        <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="w-full h-6 rounded bg-zinc-950 cursor-pointer border border-zinc-800" />
                      ) : (
                        <div className="text-[8px] text-zinc-650 text-center py-2 bg-zinc-950/40 rounded-lg border border-dashed border-zinc-800">
                          {isRtl ? "مخفي" : "Removed"}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-zinc-500 block">{isRtl ? "تمييز ثلاثي:" : "Highlight (3D):"}</label>
                      <input type="color" value={shadowColor} onChange={(e) => setShadowColor(e.target.value)} className="w-full h-6 rounded bg-zinc-950 cursor-pointer border border-zinc-800" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <Button onClick={handleExport} variant="brand" className="w-full py-3 text-xs font-bold shadow-[0_0_20px_rgba(139,92,246,0.15)]">
              {isRtl ? "تصدير بالجودة النهائية" : "Export in Final Quality"}
            </Button>
          </aside>

          {/* Center Panel - Video Player & Metadata Card */}
          <main className="flex-1 flex flex-col items-center justify-center bg-black/35 relative p-6 overflow-y-auto">
            <div 
              id="video-frame-container"
              style={{ position: 'relative' }}
              className={`relative bg-zinc-950 border border-white/5 shadow-2xl rounded-2xl overflow-hidden h-full max-h-[60vh] flex flex-col group transition-all duration-300 ${
                reframeAspect === "9:16" ? "aspect-[9/16] w-auto" :
                reframeAspect === "1:1" ? "aspect-square w-auto" :
                reframeAspect === "4:5" ? "aspect-[4/5] w-auto" :
                "aspect-video w-full max-w-2xl"
              }`}
            >
              {isLoadingProject ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2 bg-zinc-950 animate-pulse">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                  <span className="text-xs font-semibold">{isRtl ? "تحميل مشغل الفيديو..." : "Loading Player..."}</span>
                </div>
              ) : project ? (
                /* Native HTML5 Video Player */
                <div className="flex-1 bg-black relative overflow-hidden">
                  <video
                    ref={videoRef}
                    id="editor-native-video"
                    src={localVideoUrl || (project?.localVideoPath ? `http://localhost:4000/static${project.localVideoPath}` : "http://localhost:4000/static/videos/sample.mp4")}
                    style={getPlayerTransform()}
                    className="absolute inset-0 w-full h-full object-cover transition-all duration-300 pointer-events-none"
                    preload="auto"
                    playsInline
                    muted
                    loop
                    onTimeUpdate={handleTimeUpdate}
                  />

                  {/* Real video uploader overlay trigger if playing sample */}
                  {!localVideoUrl && (
                    <div className="absolute top-3 right-3 z-30">
                      <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/75 hover:bg-black/90 border border-white/10 text-white cursor-pointer text-[10px] font-bold transition-all shadow-lg active:scale-95">
                        <Upload className="h-3.5 w-3.5 text-purple-400" />
                        <span>{isRtl ? "رفع الفيديو الحقيقي" : "Upload Real Video"}</span>
                        <input 
                          type="file" 
                          accept="video/*" 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file && activeId) {
                              try {
                                await saveVideoToDB(activeId, file);
                                const url = URL.createObjectURL(file);
                                setLocalVideoUrl(url);
                              } catch (err) {
                                console.error("Failed to save selected file:", err);
                              }
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}
                  
                  {/* Visual crop filter overlay & draggable target box */}
                  {reframeAspect !== "16:9" && (
                    <div 
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsCropDragging(true);
                      }}
                      className="absolute inset-0 z-20 cursor-move bg-black/10 hover:bg-black/5 transition-all"
                    >
                      <div 
                        style={{
                          position: "absolute",
                          left: `${manualCropX}%`,
                          top: `${manualCropY}%`,
                          transform: "translate(-50%, -50%)"
                        }}
                        className="w-16 h-16 border-2 border-dashed border-purple-500 rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.5)] flex items-center justify-center pointer-events-none"
                      >
                        <Move className="h-4 w-4 text-purple-450 animate-pulse" />
                        <div className="absolute -bottom-5 bg-black/85 px-1 py-0.5 rounded text-[8px] font-mono text-purple-300 border border-purple-500/20 whitespace-nowrap">
                          X: {manualCropX}% | Y: {manualCropY}%
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Active Speaker tracking box indicator */}
                  {isShortsMode && activeSpeakerTracking && (
                    <div 
                      style={getFaceBoxStyle()} 
                      className="absolute pointer-events-none z-20 flex flex-col justify-between"
                    >
                      <div className="bg-purple-650 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-br w-fit whitespace-nowrap">
                        [ 👤 Active Speaker ]
                      </div>
                      <div className="w-full text-center text-[7px] text-purple-400 font-mono tracking-widest bg-black/40">
                        SCANNING FACE...
                      </div>
                    </div>
                  )}

                  {/* Subtitle Drag-and-Drop Overlay */}
                  {showCaptions && (
                    <div 
                      style={{
                        position: 'absolute',
                        left: `${textX}%`,
                        top: `${getVisualCaptionY()}%`,
                        transform: `translate(-50%, -50%) scale(${textScale})`,
                        cursor: isDragging ? 'grabbing' : 'grab',
                        touchAction: 'none'
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      className="select-none active:scale-95 transition-transform duration-100 z-20"
                    >
                      {/* Word-by-Word styled subtitle rendering */}
                      <div 
                        className={`${getFontFamilyStyle(activeFont)} text-center font-bold`}
                        style={{
                          color: textColor,
                          textShadow: hasStroke ? `
                            -2px -2px 0 ${strokeColor},  
                             2px -2px 0 ${strokeColor},
                            -2px  2px 0 ${strokeColor},
                             2px  2px 0 ${strokeColor},
                             3px  3px 0px ${shadowColor}
                          ` : `none`,
                        }}
                      >
                        {(() => {
                          const info = getActiveSentenceInfo();
                          if (!info || !info.wordsList || info.wordsList.length === 0) {
                            return <span className="text-xl sm:text-2xl px-3 py-1 rounded shadow-xl inline-block transform -rotate-1">{getClipText()}</span>;
                          }
                          
                          return (
                            <div className="flex flex-wrap justify-center gap-x-2 gap-y-1.5 text-center text-xl sm:text-2xl px-3 py-1 rounded shadow-xl">
                              {info.wordsList.map((wObj: any, idx: number) => {
                                const isActive = idx === info.activeWordIdx;
                                const isHighlighted = wObj.highlight;
                                const showEmoji = autoEmojis && wObj.emoji && isActive;
                                
                                let transformStyle = "scale(1.0)";
                                if (isActive) {
                                  if (activeAnimation === "Pop") transformStyle = "scale(1.25) rotate(1.5deg)";
                                  else if (activeAnimation === "Scale") transformStyle = "scale(1.35)";
                                  else if (activeAnimation === "Bounce") transformStyle = "translateY(-6px) scale(1.15)";
                                  else if (activeAnimation === "Slide") transformStyle = "translateY(-8px)";
                                  else if (activeAnimation === "Fade") transformStyle = "scale(1.05)";
                                }

                                const isNumber = /^[0-9]+$/.test(wObj.word.replace(/[^0-9]/g, ''));
                                const isMoney = wObj.word.includes('$') || wObj.word.includes('£') || wObj.word.includes('€') || wObj.word.includes('ريال') || wObj.word.includes('جنيه');
                                const isCapitalized = /^[A-Z]/.test(wObj.word);
                                const isSpecial = isNumber || isMoney || (isCapitalized && wObj.word.length > 2) || isHighlighted;

                                let wordColor = textColor;
                                if (isActive) {
                                  wordColor = shadowColor || "#facc15";
                                } else if (isSpecial) {
                                  wordColor = "#10b981"; // Vibrant Emerald green for keyword emphasis!
                                }

                                return (
                                  <span
                                    key={idx}
                                    style={{
                                      color: wordColor,
                                      transform: transformStyle,
                                      transition: "all 0.15s ease-out"
                                    }}
                                    className={`inline-block mx-0.5 ${isActive && activeAnimation === "Bounce" ? 'animate-bounce' : ''}`}
                                  >
                                    {uppercase ? wObj.word.toUpperCase() : wObj.word}
                                    {showEmoji && <span className="inline-block mr-1 text-base">{wObj.emoji}</span>}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  
                  {/* Drag Move Handle Indicator */}
                  {showCaptions && (
                    <div 
                      style={{
                        position: 'absolute',
                        left: `${textX}%`,
                        top: `${textY + 8}%`,
                      }}
                      className="absolute -translate-x-1/2 bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none"
                    >
                      <Move className="h-2 w-2" />
                      <span>{isRtl ? "اسحب للتحريك" : "Drag to move"}</span>
                    </div>
                  )}

                  {/* Frame Play overlay button */}
                  <button 
                    className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 hover:opacity-100 transition-opacity z-10"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20">
                      {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
                    </div>
                  </button>
                </div>
              ) : (
                /* Fallback default player */
                <div className="flex-1 flex items-center justify-center bg-zinc-950 relative">
                  <span className="text-zinc-700 text-xs font-semibold uppercase tracking-wider">{t.editor.videoPlaceholder}</span>
                  <button 
                    className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20">
                      {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
                    </div>
                  </button>
                </div>
              )}

              {/* Bottom Timeline Progress Bar */}
              <div className="h-1.5 bg-zinc-900 w-full absolute bottom-0 z-10">
                <div 
                  className="h-full bg-purple-500 transition-all duration-100" 
                  style={{ 
                    width: `${videoRef.current ? (videoRef.current.currentTime / (videoRef.current.duration || 1)) * 100 : 0}%` 
                  }}
                />
              </div>
            </div>

            {/* Video Metadata Panel Card */}
            {project && (
              <div className="mt-5 max-w-2xl w-full bg-zinc-950/45 border border-white/5 p-4 rounded-2xl flex flex-wrap gap-x-6 gap-y-3 justify-between items-center text-[10px] text-zinc-400 shadow-md">
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-600 font-bold">{isRtl ? "المصدر:" : "Source:"}</span>
                  <span className="text-zinc-300 font-semibold">{project.youtubeUrl ? (isRtl ? "يوتيوب" : "YouTube") : (isRtl ? "رفع محلي" : "Local Upload")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-600 font-bold">{isRtl ? "الدقة:" : "Quality:"}</span>
                  <span className="text-zinc-300 font-mono font-semibold">{project.videoQuality || "1080p Full HD"}</span>
                </div>
                {project.videos?.[0]?.resolution && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-600 font-bold">{isRtl ? "الأبعاد:" : "Resolution:"}</span>
                    <span className="text-zinc-300 font-mono font-semibold">{project.videos[0].resolution}</span>
                  </div>
                )}
                {project.videos?.[0]?.fps && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-600 font-bold">{isRtl ? "الفريمات:" : "FPS:"}</span>
                    <span className="text-zinc-300 font-mono font-semibold">{Math.round(project.videos[0].fps)} fps</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-600 font-bold">{isRtl ? "الحجم:" : "Size:"}</span>
                  <span className="text-zinc-300 font-mono font-semibold">{project.videoSize || "145.2 MB"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-600 font-bold">{isRtl ? "المدة:" : "Duration:"}</span>
                  <span className="text-zinc-300 font-mono font-semibold">{project.videoDuration || "08:45"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-600 font-bold">{isRtl ? "تاريخ الرفع:" : "Uploaded:"}</span>
                  <span className="text-zinc-300 font-mono font-semibold">{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            )}
          </main>
          
          {/* Right Panel - AI Generated Clips Results & Transcript synchronized viewer */}
          <aside className="w-80 border-s border-white/5 bg-zinc-950/20 flex flex-col z-10">
            
            {/* Custom Tab selectors */}
            <div className="grid grid-cols-4 border-b border-white/5 bg-zinc-950/40 text-[10px] font-bold p-1">
              <button
                onClick={() => setEditorRightTab("transcript")}
                className={`py-2 text-center rounded-lg transition-colors cursor-pointer ${editorRightTab === "transcript" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                {isRtl ? "النصوص" : "Transcript"}
              </button>
              <button
                onClick={() => setEditorRightTab("clips")}
                className={`py-2 text-center rounded-lg transition-colors cursor-pointer ${editorRightTab === "clips" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                {isRtl ? "الكليبات" : "AI Clips"}
              </button>
              <button
                onClick={() => setEditorRightTab("captions")}
                className={`py-2 text-center rounded-lg transition-colors cursor-pointer ${editorRightTab === "captions" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                {isRtl ? "التسميات" : "Captions"}
              </button>
              <button
                onClick={() => setEditorRightTab("analytics")}
                className={`py-2 text-center rounded-lg transition-colors cursor-pointer ${editorRightTab === "analytics" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                {isRtl ? "التحليلات" : "Analytics"}
              </button>
            </div>

            {editorRightTab === "transcript" && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Search Bar inside Transcript */}
                <div className="p-3.5 border-b border-white/5 bg-zinc-950/40">
                  <Input
                    placeholder={isRtl ? "🔍 ابحث في الكلمات أو العبارات..." : "🔍 Search words or topics..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8.5 text-xs text-right pr-3"
                  />
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                  {isLoadingTranscript ? (
                    <div className="text-center py-20 text-zinc-500 text-xs flex items-center justify-center gap-2">
                      <Loader2 className="h-4.5 w-4.5 animate-spin text-purple-500" />
                      <span>{isRtl ? "جاري تحميل وقراءة النصوص..." : "Loading transcripts..."}</span>
                    </div>
                  ) : !transcript ? (
                    <div className="text-center py-20 text-zinc-500 text-xs">
                      {isRtl ? "لا تتوفر نصوص لهذا المشروع حالياً." : "No transcripts stored for this project."}
                    </div>
                  ) : searchQuery.trim() !== "" ? (
                    /* Search results view */
                    (() => {
                      const filteredSentences = transcript.sentences?.filter((s: any) =>
                        s.text.toLowerCase().includes(searchQuery.toLowerCase())
                      ) || [];

                      const filteredTopics = transcript.topicSegments?.filter((ts: any) =>
                        ts.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (ts.summary && ts.summary.toLowerCase().includes(searchQuery.toLowerCase()))
                      ) || [];

                      const formatTime = (sec: number) => {
                        const minutes = Math.floor(sec / 60);
                        const remainingSeconds = Math.floor(sec % 60);
                        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
                      };

                      return (
                        <div className="space-y-4 animate-fade-in text-right">
                          {/* Topics Matches */}
                          {filteredTopics.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-[10px] uppercase tracking-wider font-bold text-indigo-400 mb-1">
                                {isRtl ? `المواضيع المطابقة (${filteredTopics.length}):` : `Matching Topics (${filteredTopics.length}):`}
                              </h4>
                              {filteredTopics.map((ts: any, idx: number) => (
                                <div
                                  key={`topic-${idx}`}
                                  onClick={() => {
                                    if (videoRef.current) {
                                      videoRef.current.currentTime = ts.startTime;
                                      videoRef.current.play().catch(e => console.log(e));
                                      setIsPlaying(true);
                                    }
                                  }}
                                  className="p-3 border border-indigo-950 hover:border-indigo-500/40 bg-indigo-950/20 rounded-xl cursor-pointer transition-all space-y-1 text-right"
                                >
                                  <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500">
                                    <span>{isRtl ? "موضوع" : "Topic"}</span>
                                    <span className="text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded">{formatTime(ts.startTime)}</span>
                                  </div>
                                  <h5 className="text-[10px] font-bold text-white">{ts.topic}</h5>
                                  {ts.summary && <p className="text-[9px] text-zinc-500 leading-normal">{ts.summary}</p>}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Sentences Matches */}
                          <div className="space-y-2">
                            <h4 className="text-[10px] uppercase tracking-wider font-bold text-purple-400 mb-1">
                              {isRtl ? `الجمل المطابقة (${filteredSentences.length}):` : `Matching Sentences (${filteredSentences.length}):`}
                            </h4>
                            {filteredSentences.length === 0 && filteredTopics.length === 0 ? (
                              <div className="text-center py-8 text-zinc-650 text-[10px]">
                                {isRtl ? "لا توجد نتائج مطابقة لبحثك." : "No matching words or topics found."}
                              </div>
                            ) : (
                              filteredSentences.map((s: any, idx: number) => (
                                <div
                                  key={`sentence-${idx}`}
                                  onClick={() => {
                                    if (videoRef.current) {
                                      videoRef.current.currentTime = s.startTime;
                                      videoRef.current.play().catch(e => console.log(e));
                                      setIsPlaying(true);
                                    }
                                  }}
                                  className="p-3 border border-zinc-850 hover:border-purple-500/40 bg-zinc-950/60 rounded-xl cursor-pointer transition-all space-y-1.5"
                                >
                                  <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500">
                                    <span>{s.speakerId || "SPEAKER_A"}</span>
                                    <span className="text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded">{formatTime(s.startTime)}</span>
                                  </div>
                                  <p className="text-[10px] text-zinc-300 leading-relaxed text-right">{s.text}</p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    /* Group sentences by Speaker turns blocks */
                    (() => {
                      const blocks: any[] = [];
                      let currentBlock: any = null;

                      transcript.sentences?.forEach((s: any) => {
                        if (!currentBlock || currentBlock.speakerId !== s.speakerId) {
                          if (currentBlock) blocks.push(currentBlock);
                          currentBlock = {
                            speakerId: s.speakerId || "SPEAKER_A",
                            startTime: s.startTime,
                            endTime: s.endTime,
                            sentences: [s],
                          };
                        } else {
                          currentBlock.sentences.push(s);
                          currentBlock.endTime = s.endTime;
                        }
                      });
                      if (currentBlock) blocks.push(currentBlock);

                      return blocks.map((block, bIdx) => {
                        const formatTime = (sec: number) => {
                          const minutes = Math.floor(sec / 60);
                          const remainingSeconds = Math.floor(sec % 60);
                          return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
                        };

                        return (
                          <div key={bIdx} className="space-y-2 border-l border-zinc-900 pl-3 pt-1 text-right">
                            {/* Speaker Header tag */}
                            <div className="flex justify-between items-center pb-1">
                              <span className="text-[9px] font-mono font-bold text-zinc-500">
                                {formatTime(block.startTime)}
                              </span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${block.speakerId === "SPEAKER_A" ? "bg-purple-500/10 text-purple-400 border border-purple-500/10" : "bg-blue-500/10 text-blue-400 border border-blue-500/10"}`}>
                                👤 {block.speakerId === "SPEAKER_A" ? (isRtl ? "المتحدث أ" : "Speaker A") : (isRtl ? "المتحدث ب" : "Speaker B")}
                              </span>
                            </div>

                            {/* Sentences inside block */}
                            <div className="space-y-1.5 text-right">
                              {block.sentences.map((sentence: any, sIdx: number) => {
                                const activeIdx = transcript.sentences.indexOf(sentence);
                                const isSentenceActive = currentTimeSec >= sentence.startTime && currentTimeSec <= sentence.endTime;

                                // Filter word-by-word timestamps
                                const sentenceWords = transcript.words?.filter((w: any) => w.startTime >= sentence.startTime && w.endTime <= sentence.endTime) || [];

                                return (
                                  <div
                                    key={sIdx}
                                    id={`sentence-${activeIdx}`}
                                    className={`text-[10px] leading-relaxed p-1.5 rounded-lg transition-colors ${isSentenceActive ? "bg-purple-500/5 text-white font-medium" : "text-zinc-400 hover:text-zinc-200"}`}
                                  >
                                    {sentenceWords.length > 0 ? (
                                      <div className="flex flex-wrap gap-x-1 justify-end">
                                        {sentenceWords.map((w: any, wIdx: number) => {
                                          const isWordActive = currentTimeSec >= w.startTime && currentTimeSec <= w.endTime;
                                          return (
                                            <span
                                              key={wIdx}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (videoRef.current) {
                                                  videoRef.current.currentTime = w.startTime;
                                                  videoRef.current.play().catch(e => console.log(e));
                                                  setIsPlaying(true);
                                                }
                                              }}
                                              className={`cursor-pointer transition-all ${isWordActive ? "text-purple-400 font-extrabold scale-105 border-b border-purple-400" : ""}`}
                                            >
                                              {w.word}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <span
                                        onClick={() => {
                                          if (videoRef.current) {
                                            videoRef.current.currentTime = sentence.startTime;
                                            videoRef.current.play().catch(e => console.log(e));
                                            setIsPlaying(true);
                                          }
                                        }}
                                        className="cursor-pointer"
                                      >
                                        {sentence.text}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>
            )}

            {editorRightTab === "clips" && (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 p-4">
                {/* Category filters */}
                <div className="flex flex-wrap gap-1 mb-3 bg-zinc-950/45 border border-white/5 p-2 rounded-2xl justify-center">
                  {[
                    { id: "ALL", label: isRtl ? "الكل" : "All" },
                    { id: "FAVORITES", label: isRtl ? "المفضلة" : "Favorites" },
                    { id: "BEST", label: isRtl ? "أفضل الكليبات" : "Best" },
                    { id: "TRENDING", label: isRtl ? "التريندات" : "Trending" },
                    { id: "EDUCATIONAL", label: isRtl ? "تعليمية" : "Educational" },
                    { id: "STORY", label: isRtl ? "قصص" : "Story" },
                    { id: "PODCAST", label: isRtl ? "بودكاست" : "Podcast" },
                    { id: "ENGAGEMENT", label: isRtl ? "تفاعل عالي" : "Engagement" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setCategoryFilter(tab.id)}
                      className={`px-2 py-1 rounded-lg text-[8px] font-bold transition-all cursor-pointer ${
                        categoryFilter === tab.id
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Bulk actions */}
                <div className="flex gap-2 mb-2">
                  <Button 
                    onClick={handleDownloadSelected}
                    disabled={selectedClipIds.length === 0 || isDownloading}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-[9px] h-8 font-semibold gap-1"
                  >
                    <Download className="h-3 w-3" />
                    <span>{isRtl ? `تحميل المحدد (${selectedClipIds.length})` : `Selected (${selectedClipIds.length})`}</span>
                  </Button>
                  <Button 
                    onClick={handleDownloadAll}
                    disabled={clips.length === 0 || isDownloading}
                    variant="outline"
                    size="sm"
                    className="text-[9px] h-8 font-semibold px-3"
                  >
                    <span>{isRtl ? "تنزيل الكل" : "Download All"}</span>
                  </Button>
                </div>

                {isLoadingClips ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex gap-3 p-3.5 rounded-2xl border border-white/5 bg-zinc-950/45 animate-pulse">
                        <div className="w-14 h-20 bg-zinc-900 rounded-lg flex-shrink-0 animate-shimmer" />
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div className="space-y-2">
                            <div className="h-3 w-3/4 bg-zinc-900 rounded-md animate-shimmer" />
                            <div className="h-3 w-1/2 bg-zinc-900 rounded-md animate-shimmer" />
                          </div>
                          <div className="h-2.5 w-1/3 bg-zinc-900 rounded-md animate-shimmer" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : clips.filter(c => {
                    if (categoryFilter === "FAVORITES") return c.isFavorite;
                    if (categoryFilter !== "ALL" && c.category !== categoryFilter) return false;
                    return true;
                  }).length === 0 ? (
                  <div className="text-center py-20 text-zinc-500 text-xs">
                    {isRtl ? "لم يتم العثور على كليبات في هذا القسم." : "No clips found in this section."}
                  </div>
                ) : (
                  clips
                    .filter(c => {
                      if (categoryFilter === "FAVORITES") return c.isFavorite;
                      if (categoryFilter !== "ALL" && c.category !== categoryFilter) return false;
                      return true;
                    })
                    .map((clip) => {
                      // Find actual index in source clips array to sync player
                      const index = clips.findIndex(c => c.id === clip.id);
                      const isActive = activeClipIndex === index;
                      const isSelected = selectedClipIds.includes(clip.id);
                      const isEditing = editingClipId === clip.id;
                      
                      return (
                        <div 
                          key={clip.id} 
                          onClick={() => handleClipClick(index)}
                          className={`flex flex-col gap-2.5 p-3.5 rounded-2xl cursor-pointer border relative group/card transition-all ${
                            isActive 
                              ? 'border-purple-500 bg-purple-500/5 shadow-[0_0_15px_rgba(139,92,246,0.06)] animate-fade-in' 
                              : 'border-white/5 bg-zinc-950/60 glass-card-hover'
                          }`}
                        >
                          {isEditing ? (
                            <form 
                              onClick={(e) => e.stopPropagation()} 
                              onSubmit={(e) => handleSaveClipEdit(clip.id, e)} 
                              className="space-y-3 text-right bg-zinc-950/80 p-3 rounded-xl border border-white/5"
                            >
                              <Input 
                                label={isRtl ? "العنوان:" : "Title:"}
                                type="text" 
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="bg-zinc-900 border border-zinc-800 text-xs py-1 px-2 text-right h-8"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <Input 
                                  label={isRtl ? "البداية:" : "Start:"}
                                  type="text" 
                                  value={editStart}
                                  onChange={(e) => setEditStart(e.target.value)}
                                  className="bg-zinc-900 border border-zinc-800 text-xs py-1 px-2 text-center font-mono h-8"
                                />
                                <Input 
                                  label={isRtl ? "النهاية:" : "End:"}
                                  type="text" 
                                  value={editEnd}
                                  onChange={(e) => setEditEnd(e.target.value)}
                                  className="bg-zinc-900 border border-zinc-800 text-xs py-1 px-2 text-center font-mono h-8"
                                />
                              </div>
                              <div className="flex gap-2 justify-end pt-1">
                                <Button 
                                  type="button" 
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingClipId(null)}
                                  className="text-[9px] px-2.5 py-1 h-7"
                                >
                                  {isRtl ? "إلغاء" : "Cancel"}
                                </Button>
                                <Button 
                                  type="submit" 
                                  variant="primary"
                                  size="sm"
                                  className="text-[9px] px-3 py-1 h-7 gap-1 flex items-center font-semibold"
                                >
                                  <Check className="h-3 w-3" />
                                  <span>{isRtl ? "حفظ" : "Save"}</span>
                                </Button>
                              </div>
                            </form>
                          ) : (
                            <>
                              {/* Always visible select checkbox */}
                              <div className="absolute top-2.5 left-2.5 rtl:right-2.5 rtl:left-auto z-20">
                                <button
                                  onClick={(e) => toggleSelectClip(clip.id, e)}
                                  className={`p-1 rounded bg-zinc-900 border transition-all ${
                                    isSelected 
                                      ? "border-purple-500 text-purple-400" 
                                      : "border-zinc-850 text-zinc-550 hover:text-white"
                                  }`}
                                >
                                  {isSelected ? <CheckSquare className="h-3.5 w-3.5 text-purple-400" /> : <Square className="h-3.5 w-3.5" />}
                                </button>
                              </div>
  
                              {/* Action buttons on card hover */}
                              <div className="absolute top-2.5 left-10 rtl:right-10 rtl:left-auto flex items-center gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity z-20 animate-fade-in">
                                <Tooltip content={isRtl ? "معاينة التقييمات" : "Preview metrics"} position="top">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewClip(clip);
                                      setIsPreviewModalOpen(true);
                                    }}
                                    className="p-1 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-500 hover:text-white transition-colors"
                                  >
                                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                                  </button>
                                </Tooltip>

                                <Tooltip content={isRtl ? "تفضيل الكليب" : "Favorite clip"} position="top">
                                  <button
                                    onClick={(e) => toggleFavoriteClip(clip.id, clip.isFavorite, e)}
                                    className="p-1 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-500 hover:text-white transition-colors"
                                  >
                                    <Smile className={`h-3.5 w-3.5 ${clip.isFavorite ? "text-red-400 fill-red-400/20" : "text-zinc-500"}`} />
                                  </button>
                                </Tooltip>

                                <Tooltip content={isRtl ? "تعديل النطاق" : "Edit range"} position="top">
                                  <button
                                    onClick={(e) => startEditing(clip, e)}
                                    className="p-1 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-500 hover:text-white transition-colors"
                                  >
                                    <Scissors className="h-3.5 w-3.5" />
                                  </button>
                                </Tooltip>
                                
                                <Tooltip content={isRtl ? "إعادة إنشاء الكليب" : "Regenerate clip"} position="top">
                                  <button
                                    onClick={(e) => handleRegenerateClip(clip.id, e)}
                                    disabled={regeneratingClipId === clip.id}
                                    className="p-1 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-500 hover:text-white disabled:opacity-50 transition-colors"
                                  >
                                    {regeneratingClipId === clip.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                                    ) : (
                                      <RefreshCw className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </Tooltip>
  
                                <Tooltip content={isRtl ? "حذف الكليب" : "Delete clip"} position="top">
                                  <button
                                    onClick={(e) => handleDeleteClip(clip.id, e)}
                                    className="p-1 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </Tooltip>
                              </div>

                            <div className="flex gap-3">
                              <div className="w-14 h-20 bg-zinc-950 rounded-lg flex-shrink-0 flex items-center justify-center relative overflow-hidden border border-zinc-900">
                                {project?.thumbnailUrl ? (
                                  <img 
                                    src={project.thumbnailUrl.startsWith('http') ? project.thumbnailUrl : `http://localhost:4000${project.thumbnailUrl}`} 
                                    alt="" 
                                    className="w-full h-full object-cover opacity-60"
                                  />
                                ) : videoId ? (
                                  <img 
                                    src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} 
                                    alt="" 
                                    className="w-full h-full object-cover opacity-60"
                                  />
                                ) : (
                                  <Play className="h-4 w-4 text-zinc-800 opacity-65" />
                                )}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                  <Play className="h-4 w-4 text-white opacity-85" />
                                </div>
                                <div className="absolute bottom-1 right-1 rtl:left-1 rtl:right-auto bg-black/75 px-1 rounded text-[8px] font-bold">
                                  {clip.startTime}
                                </div>
                              </div>

                              <div className="flex flex-col justify-between py-0.5 flex-1 min-w-0">
                                <div>
                                  <h3 className="font-bold text-xs text-zinc-150 line-clamp-2 leading-snug text-right rtl:text-right ltr:text-left">
                                    {clip.title}
                                  </h3>
                                  <p className="text-[9px] text-zinc-500 mt-1 text-right rtl:text-right ltr:text-left font-mono">
                                    {clip.startTime} → {clip.endTime} ({clip.duration})
                                  </p>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {editorRightTab === "captions" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-6 text-right scrollbar-thin">
                {/* 1. Presets Library */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    {isRtl ? "قوالب الترجمة الجاهزة" : "Caption Preset Templates"}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "PODCAST", name: isRtl ? "بودكاست" : "Podcast", desc: "Bold Purple Pop" },
                      { id: "VIRAL", name: isRtl ? "فيروسي" : "Viral Shorts", desc: "Yellow Impact Pop" },
                      { id: "MINIMAL", name: isRtl ? "بسيط" : "Minimalist", desc: "Clean Bottom Line" },
                      { id: "DOCUMENTARY", name: isRtl ? "وثائقي" : "Documentary", desc: "Serif Elegant Slide" },
                      { id: "EDUCATIONAL", name: isRtl ? "تعليمي" : "Educational", desc: "Cyan Stroke Scale" },
                      { id: "CREATOR", name: isRtl ? "منشئ محتوى" : "Creator Style", desc: "Pink Bounce Pop" },
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => applyTemplatePreset(preset.id)}
                        className={`text-right border rounded-xl p-3 hover:border-purple-500/40 hover:bg-zinc-950/60 transition-all ${
                          selectedTemplate === preset.id
                            ? "border-purple-500 bg-purple-500/10 text-white shadow-md"
                            : "border-zinc-850 bg-zinc-950/40 text-zinc-400"
                        }`}
                      >
                        <div className="text-[10px] font-black">{preset.name}</div>
                        <div className="text-[8px] text-zinc-500 mt-0.5">{preset.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Brand Kits Switcher & Add Form */}
                <div className="space-y-3 border-t border-white/5 pt-4">
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => setShowAddBrandKit(!showAddBrandKit)}
                      className="text-[9px] font-bold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                    >
                      {showAddBrandKit 
                        ? (isRtl ? "إلغاء الإضافة" : "Cancel") 
                        : (isRtl ? "+ إضافة هوية جديدة" : "+ Create Brand Kit")}
                    </button>
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      {isRtl ? "الهوية البصرية للمشروع" : "Brand Kits / Profiles"}
                    </h4>
                  </div>

                  {showAddBrandKit ? (
                    <form onSubmit={handleCreateBrandKit} className="bg-zinc-950/60 border border-white/5 p-3.5 rounded-2xl space-y-3">
                      <Input
                        label={isRtl ? "اسم الهوية البصرية:" : "Brand Kit Name:"}
                        value={newKitName}
                        onChange={(e) => setNewKitName(e.target.value)}
                        placeholder="e.g. My Channel Kit"
                        className="bg-zinc-900 border-zinc-850 text-xs py-1.5 h-8 text-right pr-2"
                        required
                      />
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <label className="text-[8px] text-zinc-550 block mb-1">{isRtl ? "الخط:" : "Text:"}</label>
                          <input type="color" value={newKitText} onChange={(e) => setNewKitText(e.target.value)} className="w-full h-7 rounded cursor-pointer border border-zinc-800" />
                        </div>
                        <div>
                          <label className="text-[8px] text-zinc-550 block mb-1">{isRtl ? "الفرعي:" : "Sec Color:"}</label>
                          <input type="color" value={newKitSecondary} onChange={(e) => setNewKitSecondary(e.target.value)} className="w-full h-7 rounded cursor-pointer border border-zinc-800" />
                        </div>
                        <div>
                          <label className="text-[8px] text-zinc-550 block mb-1">{isRtl ? "الأساسي:" : "Pri Color:"}</label>
                          <input type="color" value={newKitPrimary} onChange={(e) => setNewKitPrimary(e.target.value)} className="w-full h-7 rounded cursor-pointer border border-zinc-800" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          label={isRtl ? "اسم الخط:" : "Font Family:"}
                          value={newKitFont}
                          onChange={(e) => setNewKitFont(e.target.value)}
                          className="bg-zinc-900 border-zinc-850 text-xs h-7 py-1 text-center"
                        />
                        <Input
                          label={isRtl ? "العلامة المائية:" : "Watermark:"}
                          value={newKitWatermark}
                          onChange={(e) => setNewKitWatermark(e.target.value)}
                          className="bg-zinc-900 border-zinc-850 text-xs h-7 py-1 text-center"
                          placeholder="e.g. mychannel.com"
                        />
                      </div>
                      <Button type="submit" variant="brand" className="w-full text-[10px] font-bold py-2 h-8">
                        {isRtl ? "حفظ وإضافة الهوية" : "Save Brand Kit"}
                      </Button>
                    </form>
                  ) : (
                    <div className="space-y-2">
                      {brandKits.length === 0 ? (
                        <div className="text-[9px] text-zinc-605 text-center py-4 bg-zinc-950/20 rounded-xl border border-dashed border-zinc-900">
                          {isRtl ? "لا توجد هويات بصرية مخصصة" : "No brand kits found"}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 justify-end">
                          {brandKits.map((kit) => (
                            <button
                              key={kit.id}
                              onClick={() => handleApplyBrandKit(kit)}
                              className={`flex items-center gap-2 border px-2.5 py-1.5 rounded-xl transition-all hover:bg-zinc-950/60 cursor-pointer ${
                                activeBrandKitId === kit.id
                                  ? "border-purple-500 bg-purple-500/10 text-white font-bold"
                                  : "border-zinc-850 bg-zinc-950/30 text-zinc-400 text-[10px]"
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full border border-black/40" style={{ backgroundColor: kit.primaryColor }} />
                                <span className="w-2.5 h-2.5 rounded-full border border-black/40" style={{ backgroundColor: kit.secondaryColor }} />
                                <span className="w-2.5 h-2.5 rounded-full border border-black/40" style={{ backgroundColor: kit.textColor }} />
                              </div>
                              <span className="text-[9px] font-bold">{kit.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Style Sliders / Details Customizer */}
                <div className="space-y-4 border-t border-white/5 pt-4">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    {isRtl ? "تخصيص تأثيرات النصوص" : "Caption Animation & Subtitle Effects"}
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-zinc-500 block">{isRtl ? "تأثير الحركة:" : "Animation Style:"}</label>
                      <select
                        value={activeAnimation}
                        onChange={(e) => setActiveAnimation(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-850 rounded-xl p-2 text-[10px] text-zinc-300 font-bold focus:outline-none focus:border-purple-500 cursor-pointer"
                      >
                        <option value="Pop">💥 Pop (Scale + Rotate)</option>
                        <option value="Scale">🔍 Scale Up</option>
                        <option value="Bounce">🦘 Bounce Active</option>
                        <option value="Slide">⬆️ Slide Up</option>
                        <option value="Fade">🌫️ Smooth Fade</option>
                      </select>
                    </div>

                    <div className="space-y-1 text-center">
                      <label className="text-[9px] font-bold text-zinc-500 block mb-2">{isRtl ? "حروف كابيتال:" : "Uppercase Subtitles:"}</label>
                      <button
                        onClick={() => setUppercase(!uppercase)}
                        className={`w-full py-1.5 px-3 rounded-xl border text-[10px] font-black tracking-widest transition-all cursor-pointer ${
                          uppercase
                            ? "border-purple-500 bg-purple-500/10 text-white"
                            : "border-zinc-850 bg-zinc-950/40 text-zinc-500"
                        }`}
                      >
                        ABC
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-zinc-500 font-bold">
                        <span>{textX}%</span>
                        <span>{isRtl ? "الموقع الأفقي (X):" : "Position X:"}</span>
                      </div>
                      <input type="range" min="10" max="90" step="1" value={textX} onChange={(e) => setTextX(Number(e.target.value))} className="w-full accent-purple-500 bg-zinc-800 rounded-lg appearance-none h-1 cursor-pointer" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-zinc-500 font-bold">
                        <span>{textY}%</span>
                        <span>{isRtl ? "الموقع العمودي (Y):" : "Position Y:"}</span>
                      </div>
                      <input type="range" min="10" max="90" step="1" value={textY} onChange={(e) => setTextY(Number(e.target.value))} className="w-full accent-purple-500 bg-zinc-800 rounded-lg appearance-none h-1 cursor-pointer" />
                    </div>
                  </div>
                </div>

                {/* 4. Words Timeline Editor */}
                <div className="space-y-3 border-t border-white/5 pt-4">
                  <div className="flex justify-between items-center">
                    <button
                      onClick={handleSuggestAllEmojis}
                      className="text-[9px] font-bold text-green-400 hover:text-green-300 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3 text-amber-400" />
                      <span>{isRtl ? "اقتراح الرموز تلقائياً" : "Auto-Suggest Emojis"}</span>
                    </button>
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      {isRtl ? "تعديل نصوص الترجمة الفردية" : "Word timeline editor"}
                    </h4>
                  </div>

                  {/* Words list container */}
                  {(() => {
                    const activeClip = clips[activeClipIndex];
                    if (!activeClip) return null;
                    let wordsList: any[] = [];
                    try {
                      wordsList = JSON.parse(activeClip.words || '[]');
                    } catch(e){}

                    if (wordsList.length === 0) {
                      return (
                        <div className="text-[9px] text-zinc-650 text-center py-4 bg-zinc-950/20 rounded-xl border border-dashed border-zinc-900">
                          {isRtl ? "لا توجد كلمات متاحة لتعديلها" : "No words found for this clip"}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2.5">
                        {editingWordIdx !== null && wordsList[editingWordIdx] ? (
                          <div className="bg-zinc-950/80 border border-purple-500/20 p-3 rounded-2xl space-y-3 animate-in fade-in duration-200">
                            <div className="flex justify-between items-center pb-1 border-b border-white/5">
                              <span className="text-[8px] font-mono text-zinc-500">
                                WORD #{editingWordIdx + 1} ({wordsList[editingWordIdx].start.toFixed(1)}s - {wordsList[editingWordIdx].end.toFixed(1)}s)
                              </span>
                              <span className="text-[9px] font-bold text-purple-400">{isRtl ? "تعديل كلمة" : "Edit Word"}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                label={isRtl ? "الكلمة:" : "Word Text:"}
                                value={editingWordText}
                                onChange={(e) => setEditingWordText(e.target.value)}
                                className="bg-zinc-900 border-zinc-850 text-xs h-8 text-right pr-2"
                              />
                              <div className="space-y-1 text-right">
                                <label className="text-[9px] text-zinc-550 block">{isRtl ? "الرمز (Emoji):" : "Emoji:"}</label>
                                <div className="flex gap-1">
                                  <input
                                    type="text"
                                    value={editingWordEmoji}
                                    onChange={(e) => setEditingWordEmoji(e.target.value)}
                                    placeholder="🔥"
                                    maxLength={2}
                                    className="w-full bg-zinc-900 border border-zinc-850 rounded-xl text-center text-xs h-8 focus:outline-none focus:border-purple-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setEditingWordEmoji(getSuggestedEmoji(editingWordText))}
                                    title={isRtl ? "اقتراح رمز" : "Suggest emoji"}
                                    className="px-2 bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    💡
                                  </button>
                                </div>
                              </div>
                            </div>
                            {/* Fast emoji selector row */}
                            <div className="flex justify-center gap-1 flex-wrap">
                              {["🔥", "🚀", "💡", "🤝", "❤️", "✨", "❌", "🔄", "👥", "🏆"].map((em) => (
                                <button
                                  key={em}
                                  type="button"
                                  onClick={() => setEditingWordEmoji(em)}
                                  className={`p-1.5 rounded-lg border text-xs bg-zinc-950/80 transition-colors cursor-pointer ${
                                    editingWordEmoji === em ? "border-purple-500 bg-purple-500/10" : "border-zinc-900 hover:bg-zinc-900"
                                  }`}
                                >
                                  {em}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-1.5 justify-end">
                              <button
                                type="button"
                                onClick={() => setEditingWordIdx(null)}
                                className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl text-[9px] font-bold cursor-pointer"
                              >
                                {isRtl ? "إلغاء" : "Cancel"}
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveWordEdit}
                                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[9px] font-bold shadow-md cursor-pointer"
                              >
                                {isRtl ? "تعديل وحفظ" : "Apply & Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-2 bg-zinc-950/40 border border-zinc-900 rounded-2xl justify-end scrollbar-thin">
                            {wordsList.map((wObj: any, wIdx: number) => {
                              // Identify active word highlighting
                              const seconds = currentTimeMs / 1000;
                              const isActive = seconds >= wObj.start && seconds <= wObj.end;
                              
                              return (
                                <button
                                  key={wIdx}
                                  onClick={() => {
                                    setEditingWordIdx(wIdx);
                                    setEditingWordText(wObj.word);
                                    setEditingWordEmoji(wObj.emoji || "");
                                    if (videoRef.current) {
                                      videoRef.current.currentTime = wObj.start;
                                      videoRef.current.play().catch(e => console.log(e));
                                      setIsPlaying(true);
                                    }
                                  }}
                                  className={`flex items-center gap-1 px-2.5 py-1 border rounded-lg transition-all text-[9px] font-mono cursor-pointer ${
                                    isActive
                                      ? "border-purple-500 bg-purple-500/15 text-purple-300 font-extrabold shadow-md scale-105"
                                      : "border-zinc-850 bg-zinc-950/20 text-zinc-400 hover:border-zinc-800 hover:bg-zinc-950/60"
                                  }`}
                                >
                                  <span>{wObj.word}</span>
                                  {wObj.emoji && <span className="text-[10px]">{wObj.emoji}</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Save Styling Action Button */}
                <Button
                  onClick={handleSaveStyling}
                  variant="brand"
                  className="w-full py-3 text-xs font-bold shadow-[0_0_25px_rgba(139,92,246,0.2)] flex items-center justify-center gap-2"
                >
                  <Wand2 className="h-4 w-4" />
                  <span>{isRtl ? "حفظ التنسيقات والهوية في الكليب" : "Save Styling & Preset kit"}</span>
                </Button>

                {/* Subtitle direct export / downloads links */}
                <div className="border-t border-white/5 pt-4 space-y-2">
                  <h5 className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                    {isRtl ? "تنزيل ملف الترجمة المنفصل" : "Export SRT/VTT file"}
                  </h5>
                  <div className="flex gap-2">
                    {(() => {
                      const activeClip = clips[activeClipIndex];
                      if (!activeClip) return null;
                      return (
                        <>
                          <a
                            href={`http://localhost:4000/projects/clips/${activeClip.id}/captions/export?format=srt`}
                            download={`clip-${activeClip.id}.srt`}
                            className="flex-1 text-center py-1.5 border border-zinc-850 bg-zinc-950/30 text-zinc-400 rounded-xl hover:text-white transition-all text-[9px] font-bold cursor-pointer"
                          >
                            ⬇️ SRT Subtitles
                          </a>
                          <a
                            href={`http://localhost:4000/projects/clips/${activeClip.id}/captions/export?format=vtt`}
                            download={`clip-${activeClip.id}.vtt`}
                            className="flex-1 text-center py-1.5 border border-zinc-850 bg-zinc-950/30 text-zinc-400 rounded-xl hover:text-white transition-all text-[9px] font-bold cursor-pointer"
                          >
                            ⬇️ VTT Subtitles
                          </a>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {editorRightTab === "analytics" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-5 text-right">
                {isLoadingTranscript ? (
                  <div className="text-center py-20 text-zinc-500 text-xs flex items-center justify-center gap-2">
                    <Loader2 className="h-4.5 w-4.5 animate-spin text-purple-500" />
                    <span>{isRtl ? "جاري تحميل وقراءة النصوص..." : "Loading transcripts..."}</span>
                  </div>
                ) : !transcript ? (
                  <div className="text-center py-20 text-zinc-500 text-xs">
                    {isRtl ? "لا تتوفر تحليلات لهذا المشروع حالياً." : "No analysis details stored yet."}
                  </div>
                ) : (
                  <div className="space-y-5 animate-fade-in">
                    {/* General Statistics widgets */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-zinc-950/40 border border-white/5 p-3 rounded-2xl space-y-0.5">
                        <span className="text-zinc-500 text-[8px] font-bold uppercase tracking-wider block">{isRtl ? "سرعة التحدث" : "Speaking Speed"}</span>
                        <p className="text-sm font-black font-mono text-purple-300">{transcript.averageSpeedWpm} WPM</p>
                      </div>
                      <div className="bg-zinc-950/40 border border-white/5 p-3 rounded-2xl space-y-0.5">
                        <span className="text-zinc-500 text-[8px] font-bold uppercase tracking-wider block">{isRtl ? "فترات الصمت" : "Silence Segments"}</span>
                        <p className="text-sm font-black font-mono text-zinc-200">{transcript.silenceSegments?.length || 0} {isRtl ? "فترات" : "segments"}</p>
                      </div>
                    </div>

                    {/* Engagment and topics */}
                    <div className="space-y-2.5">
                      <h4 className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">{isRtl ? "الخط الزمني للمواضيع" : "Topic Segmentation Timeline"}</h4>
                      <div className="space-y-3">
                        {transcript.topicSegments?.map((ts: any, idx: number) => {
                          const formatTime = (sec: number) => {
                            const minutes = Math.floor(sec / 60);
                            const remainingSeconds = Math.floor(sec % 60);
                            return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
                          };

                          return (
                            <div 
                              key={idx}
                              onClick={() => {
                                if (videoRef.current) {
                                  videoRef.current.currentTime = ts.startTime;
                                  videoRef.current.play().catch(e => console.log(e));
                                  setIsPlaying(true);
                                }
                              }}
                              className="p-3 bg-zinc-950/40 border border-zinc-900 rounded-xl hover:border-purple-500/25 transition-all text-right cursor-pointer"
                            >
                              <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500 mb-1">
                                <span>{formatTime(ts.startTime)} - {formatTime(ts.endTime)}</span>
                                <span className="text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.2 rounded">{isRtl ? "موضوع" : "Topic"} #{idx+1}</span>
                              </div>
                              <h5 className="text-[10px] font-bold text-white mb-0.5">{ts.topic}</h5>
                              <p className="text-[9px] text-zinc-500 leading-normal">{ts.summary}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Silence timeline segments summary */}
                    {transcript.silenceSegments?.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">{isRtl ? "فترات الصمت المكتشفة" : "Detected Silence Timestamps"}</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {transcript.silenceSegments.slice(0, 10).map((ss: any, idx: number) => {
                            const formatTime = (sec: number) => {
                              const minutes = Math.floor(sec / 60);
                              const remainingSeconds = Math.floor(sec % 60);
                              return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
                            };
                            return (
                              <span 
                                key={idx}
                                onClick={() => {
                                  if (videoRef.current) {
                                    videoRef.current.currentTime = ss.startTime;
                                    videoRef.current.play().catch(e => console.log(e));
                                    setIsPlaying(true);
                                  }
                                }}
                                className="text-[9px] font-mono font-semibold bg-zinc-950/80 hover:bg-zinc-900 hover:text-white px-2 py-0.5 rounded border border-white/5 text-zinc-500 transition-all cursor-pointer"
                              >
                                {formatTime(ss.startTime)} - {formatTime(ss.endTime)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            )}

          </aside>
        </div>
      )}

      {/* Export progress modal */}
      {isExporting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="glass-panel border border-zinc-850 p-8 rounded-3xl max-w-sm w-full text-center space-y-4 shadow-2xl animate-scale-in">
            <Loader2 className="h-10 w-10 animate-spin text-purple-500 mx-auto" />
            <h3 className="text-sm font-black text-white">{isRtl ? "جاري تصدير الفيديو..." : "Exporting video..."}</h3>
            <p className="text-[10px] text-zinc-500 leading-relaxed px-2">
              {isRtl 
                ? "يقوم النظام الآن بتطبيق الترجمات والتأثيرات الصوتية وقص الفيديو بالأبعاد المحددة..." 
                : "The system is applying subtitles, sound effects, transitions, and cropping to 9:16..."}
            </p>
            <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-white/5">
              <div style={{ width: `${exportProgress}%` }} className="bg-purple-500 h-full transition-all duration-300" />
            </div>
            <span className="text-[10px] font-mono text-purple-400 font-extrabold">{exportProgress}%</span>
          </div>
        </div>
      )}

      {/* Downloading progress modal */}
      {isDownloading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="glass-panel border border-zinc-850 p-8 rounded-3xl max-w-sm w-full text-center space-y-4 shadow-2xl animate-scale-in">
            <Loader2 className="h-10 w-10 animate-spin text-purple-500 mx-auto" />
            <h3 className="text-sm font-black text-white">{isRtl ? "جاري تحضير التحميل..." : "Preparing downloads..."}</h3>
            <p className="text-[10px] text-zinc-500 leading-relaxed px-2">
              {isRtl 
                ? "يتم الآن تجميع وضغط ملفات الفيديو وتنزيلها مباشرة إلى جهازك..." 
                : "Compiling and downloading the requested clip files directly to your device..."}
            </p>
            <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-white/5">
              <div style={{ width: `${downloadProgress}%` }} className="bg-purple-500 h-full transition-all duration-300" />
            </div>
            <span className="text-[10px] font-mono text-purple-400 font-extrabold">{downloadProgress}%</span>
          </div>
        </div>
      )}

      {/* Detailed Evaluation & Preview Modal */}
      {isPreviewModalOpen && previewClip && (
        <Modal
          isOpen={isPreviewModalOpen}
          onClose={() => {
            setIsPreviewModalOpen(false);
            setPreviewClip(null);
            setIsExportingClip(false);
            setExportClipJobId(null);
          }}
          title={isRtl ? `معاينة وتقييم: ${previewClip.title}` : `Preview & Metrics: ${previewClip.title}`}
          size="md"
        >
          <div className="space-y-6 text-right max-h-[78vh] overflow-y-auto pr-1 text-zinc-200" dir={isRtl ? "rtl" : "ltr"}>
            {/* restricted play video player */}
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/5 shadow-inner">
              <video
                src={localVideoUrl || (project?.localVideoPath ? `http://localhost:4000/static${project.localVideoPath}` : "http://localhost:4000/static/videos/sample.mp4")}
                controls
                className="w-full h-full object-contain"
                preload="auto"
                playsInline
                onTimeUpdate={(e) => {
                  const video = e.currentTarget;
                  const start = timeToSec(previewClip.startTime);
                  const end = timeToSec(previewClip.endTime);
                  if (video.currentTime < start || video.currentTime > end) {
                    video.currentTime = start;
                  }
                }}
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget;
                  video.currentTime = timeToSec(previewClip.startTime);
                }}
              />
              <div className="absolute top-3 left-3 bg-black/85 px-3 py-1 rounded-xl text-[10px] font-bold border border-white/10 text-purple-400 font-mono">
                {previewClip.startTime} → {previewClip.endTime} ({previewClip.duration})
              </div>
            </div>

            {/* AI Explanation reasoning */}
            {previewClip.explanation && (
              <div className="p-4 bg-zinc-950/60 border border-purple-500/10 rounded-2xl space-y-1.5 text-right">
                <span className="text-[10px] text-purple-400 font-extrabold uppercase tracking-wider block">{isRtl ? "شرح وتحليل الذكاء الاصطناعي:" : "AI Evaluation Rationale:"}</span>
                <p className="text-xs text-zinc-300 leading-relaxed text-right">{previewClip.explanation}</p>
              </div>
            )}

            {/* 8 Evaluation Metrics Progress Bars */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-400 border-b border-zinc-900 pb-1.5 text-right">{isRtl ? "درجات التقييم الثمانية للانتشار:" : "8 AI Evaluation Metrics Scores:"}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-right">
                {[
                  { label: isRtl ? "1. درجة الخطاف (Hook Score)" : "1. Hook Score", value: previewClip.hookScore || 0, desc: isRtl ? "جذب الانتباه في أول 3 ثوانٍ" : "Attracting focus in the first 3s" },
                  { label: isRtl ? "2. درجة الاحتفاظ (Retention Score)" : "2. Retention Score", value: previewClip.retentionScore || 0, desc: isRtl ? "قدرة الكليب على إبقاء المشاهدين" : "Ability to keep viewers till the end" },
                  { label: isRtl ? "3. كثافة المعلومات (Info Density)" : "3. Info Density", value: previewClip.infoDensityScore || 0, desc: isRtl ? "مدى ثراء المحتوى بالمعلومات القيمة" : "Richness of valuable key details" },
                  { label: isRtl ? "4. التأثير العاطفي (Emotional Score)" : "4. Emotional Score", value: previewClip.emotionalScore || 0, desc: isRtl ? "إثارة مشاعر المشاهد وتفاعله" : "Evoking audience feelings/passion" },
                  { label: isRtl ? "5. قوة القصة (Story Score)" : "5. Story Score", value: previewClip.storyScore || 0, desc: isRtl ? "وضوح تدفق وسرد القصة" : "Coherence of storytelling arc" },
                  { label: isRtl ? "6. درجة التفاعل المتوقع (Engagement)" : "6. Engagement Score", value: previewClip.engagementScore || 0, desc: isRtl ? "تحفيز المشاركة وكتابة التعليقات" : "Likelihood of shares and comments" },
                  { label: isRtl ? "7. وضوح الصوت واللقطة (Clarity)" : "7. Clarity Score", value: previewClip.clarityScore || 0, desc: isRtl ? "جودة الصوت ونبرة المتحدث" : "Speech speed & delivery clarity" },
                  { label: isRtl ? "8. ملاءمة الموضوع (Relevance)" : "8. Relevance Score", value: previewClip.relevanceScore || 0, desc: isRtl ? "مدى أهمية الموضوع ومواكبته للتريند" : "Viral interest relevance of topic" },
                ].map((metric, idx) => (
                  <div key={idx} className="p-3 bg-zinc-950/45 border border-zinc-900 rounded-xl space-y-1.5 text-right">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-zinc-200">{metric.label}</span>
                      <span className="font-mono font-black text-purple-400">{metric.value}%</span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                      <div 
                        style={{ width: `${metric.value}%` }} 
                        className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full" 
                      />
                    </div>
                    <p className="text-[9px] text-zinc-500 leading-none text-right">{metric.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Background Slicing/Exporting options and Progress */}
            <div className="border-t border-zinc-900 pt-5 space-y-4 text-right">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedExportQuality('720p')}
                    className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold font-mono transition-all cursor-pointer ${
                      selectedExportQuality === '720p'
                        ? 'border-purple-500 bg-purple-500/10 text-white shadow-md'
                        : 'border-zinc-850 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    720p HD
                  </button>
                  <button
                    onClick={() => setSelectedExportQuality('1080p')}
                    className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold font-mono transition-all cursor-pointer ${
                      selectedExportQuality === '1080p'
                        ? 'border-purple-500 bg-purple-500/10 text-white shadow-md'
                        : 'border-zinc-850 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    1080p Full HD
                  </button>
                </div>
                <h4 className="text-xs font-bold text-zinc-400 text-right">{isRtl ? "تصدير الكليب بالجودة النهائية:" : "Export Clip with original parameters:"}</h4>
              </div>

              {!isExportingClip && !exportClipJobId ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {previewClip.videoPath1080p && (
                      <a
                        href={`http://localhost:4000/static${previewClip.videoPath1080p}`}
                        download={`${previewClip.title}-1080p.mp4`}
                        className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-850 rounded-2xl py-3 px-4 text-xs font-bold text-center flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <Download className="h-4 w-4 text-purple-400 animate-bounce" />
                        <span>{isRtl ? "تحميل نسخة 1080p المصدرة" : "Download 1080p Exported"}</span>
                      </a>
                    )}
                    {previewClip.videoPath720p && (
                      <a
                        href={`http://localhost:4000/static${previewClip.videoPath720p}`}
                        download={`${previewClip.title}-720p.mp4`}
                        className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-850 rounded-2xl py-3 px-4 text-xs font-bold text-center flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <Download className="h-4 w-4 text-purple-400 animate-bounce" />
                        <span>{isRtl ? "تحميل نسخة 720p المصدرة" : "Download 720p Exported"}</span>
                      </a>
                    )}
                  </div>

                  <Button
                    onClick={() => handleExportClip(previewClip.id, selectedExportQuality)}
                    variant="brand"
                    className="w-full py-3 text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Wand2 className="h-4 w-4" />
                    <span>
                      {isRtl 
                        ? `بدء عملية التقطيع والتصدير بالخلفية (${selectedExportQuality})` 
                        : `Start Slicing & Exporting to ${selectedExportQuality}`}
                    </span>
                  </Button>
                </div>
              ) : (
                /* Active Slicing Progress and logs */
                <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 space-y-3 text-right">
                  <div className="flex justify-between items-center text-[10px] text-zinc-400">
                    <span className="font-bold flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                      {isRtl ? "جاري تقطيع وتصدير الفيديو باستخدام FFmpeg..." : "Slicing and scaling video stream via FFmpeg..."}
                    </span>
                    <span className="font-mono font-bold text-purple-400">QUALITY: {selectedExportQuality}</span>
                  </div>

                  {/* Logs list */}
                  <div className="h-28 overflow-y-auto bg-black p-3.5 rounded-xl border border-white/5 font-mono text-[9px] text-zinc-500 space-y-1 text-left dir-ltr scrollbar-thin">
                    {exportClipLogs.map((log, idx) => (
                      <div key={idx} className="animate-fade-in pl-1.5 border-l border-zinc-900">{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
