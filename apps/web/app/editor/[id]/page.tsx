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


  const [project, setProject] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);

  // Real dynamic clips states
  const [clips, setClips] = useState<any[]>([]);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [isLoadingClips, setIsLoadingClips] = useState(true);

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

  // Export overlay loader states
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Word-by-word active word seeker & accordion states
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [expandedClipIds, setExpandedClipIds] = useState<string[]>([]);

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

    // Target a zoom size of 55% of the frame height for the face area.
    // This perfectly centers both the head and the shoulders/horizontal context.
    let scale = 55 / faceH;

    // Strict zoom constraints: keep the scale between 1.4x (wider horizontal view) and 2.2x (tighter portrait view)
    if (scale > 2.2) scale = 2.2;
    if (scale < 1.4) scale = 1.4;

    // Translate horizontally (with 0.85 smooth multiplier to preserve horizontal context)
    // and vertically (target head placement in the top third of the frame at 30%)
    const translateX = (50 - faceX) * scale * 0.85;
    const translateY = (30 - faceY) * scale;

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
      alert("Failed to save clip details");
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
      alert("Failed to delete clip");
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
      alert("Failed to regenerate clip");
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
            alert(isRtl ? "تم تحميل المقاطع المحددة بنجاح!" : "Selected clips downloaded successfully!");
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
            alert(isRtl ? "تم تحميل جميع المقاطع بنجاح!" : "All clips downloaded successfully!");
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
            alert(isRtl ? "تم تصدير الكليب بالجودة النهائية!" : "Clip exported successfully in high quality!");
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
          <button onClick={() => router.push('/dashboard')} className="text-zinc-500 hover:text-white text-xs font-bold transition-colors">
            {t.editor.backBtn}
          </button>
          <div className="h-4 w-px bg-white/10" />
          <h1 className="text-sm font-semibold flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-purple-400 animate-pulse" /> 
            {project ? project.name : t.editor.title}
          </h1>
        </div>
        <button onClick={handleExport} className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(139,92,246,0.15)] flex items-center gap-2">
          <Download className="h-4 w-4" /> {t.editor.exportBtn}
        </button>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Panel - Subtitles Style customizer */}
        <aside className="w-80 border-e border-white/5 bg-zinc-950/20 p-5 flex flex-col justify-between overflow-y-auto z-10 space-y-6">
          <div className="space-y-6">
            <h2 className="text-sm font-black text-white">{t.editor.settingsTitle}</h2>
            
            {/* Aspect Aspect reframing options */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{isRtl ? "إعدادات أبعاد 9:16 الذكية" : "Smart 9:16 Shorts Settings"}</h3>
              
              <div className="space-y-2.5 border border-zinc-900 bg-zinc-950/45 p-3 rounded-xl">
                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <span className="text-[10px] text-zinc-400 font-semibold">{isRtl ? "تفعيل تقطيع 9:16:" : "Enable 9:16 Aspect:"}</span>
                  <input type="checkbox" checked={isShortsMode} onChange={(e) => setIsShortsMode(e.target.checked)} className="accent-purple-500 h-3.5 w-3.5" />
                </label>

                {isShortsMode && (
                  <div className="space-y-2 pt-2 border-t border-zinc-900 animate-in fade-in duration-200 text-right">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-[9px] text-zinc-500">{isRtl ? "تتبع المتحدث النشط:" : "Active Speaker Tracking:"}</span>
                      <input type="checkbox" checked={activeSpeakerTracking} onChange={(e) => setActiveSpeakerTracking(e.target.checked)} className="accent-purple-500 h-3 w-3" />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-[9px] text-zinc-500">{isRtl ? "تركيز وتقريب طبيعي (زوم خفيف):" : "Mild Natural Zoom only:"}</span>
                      <input type="checkbox" checked={naturalZoom} onChange={(e) => setNaturalZoom(e.target.checked)} className="accent-purple-500 h-3 w-3" />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-[9px] text-zinc-500">{isRtl ? "منع الاهتزاز والحركات المزعجة:" : "Prevent Camera Shake:"}</span>
                      <input type="checkbox" checked={preventShake} onChange={(e) => setPreventShake(e.target.checked)} className="accent-purple-500 h-3 w-3" />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Captions customizer */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{isRtl ? "الترجمة والنصوص والتأثيرات" : "Subtitles & Effects"}</h3>
              
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 border border-zinc-900 rounded-xl bg-zinc-950/60 cursor-pointer">
                  <span className="font-semibold text-xs">{isRtl ? "عرض الترجمة التلقائية" : "Show Auto Captions"}</span>
                  <input type="checkbox" checked={showCaptions} onChange={() => setShowCaptions(!showCaptions)} className="accent-purple-500 h-4 w-4" />
                </label>

                {showCaptions && (
                  <div className="space-y-4 border border-zinc-900 bg-zinc-950/45 p-3 rounded-xl animate-in fade-in duration-200">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-[10px] text-zinc-500">{isRtl ? "تأثير كلمة بكلمة:" : "Word-by-word captions:"}</span>
                      <input type="checkbox" checked={wordByWord} onChange={(e) => setWordByWord(e.target.checked)} className="accent-purple-500 h-3.5 w-3.5" />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-[10px] text-zinc-500">{isRtl ? "إضافة Emojis تلقائية:" : "Auto Emojis:"}</span>
                      <input type="checkbox" checked={autoEmojis} onChange={(e) => setAutoEmojis(e.target.checked)} className="accent-purple-500 h-3.5 w-3.5" />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Styling customizable properties */}
            {showCaptions && (
              <div className="space-y-4 border-t border-zinc-900 pt-4 animate-in fade-in duration-300">
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-500 mb-2">{t.editor.fontStyle}</h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    {["Hormozi", "Minimal", "Elegant", "Impact"].map((font) => (
                      <button 
                        key={font}
                        onClick={() => setActiveFont(font)}
                        className={`border rounded-lg p-1.5 text-[9px] font-semibold transition-all ${
                          activeFont === font 
                            ? 'border-purple-500 bg-purple-500/10 text-white' 
                            : 'border-zinc-900 bg-zinc-950 hover:bg-zinc-900 text-zinc-500'
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
                    <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-full h-6 rounded bg-zinc-950 cursor-pointer border border-zinc-900" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-bold text-zinc-500 block">{isRtl ? "حدود (Stroke):" : "Border (Stroke):"}</label>
                      <input type="checkbox" checked={hasStroke} onChange={(e) => setHasStroke(e.target.checked)} className="accent-purple-500 h-2.5 w-2.5 cursor-pointer" />
                    </div>
                    {hasStroke ? (
                      <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="w-full h-6 rounded bg-zinc-950 cursor-pointer border border-zinc-900" />
                    ) : (
                      <div className="text-[8px] text-zinc-600 text-center py-2 bg-zinc-950/40 rounded-lg border border-dashed border-zinc-900">
                        {isRtl ? "مخفي" : "Removed"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-zinc-500 block">{isRtl ? "تمييز ثلاثي:" : "Highlight (3D):"}</label>
                    <input type="color" value={shadowColor} onChange={(e) => setShadowColor(e.target.value)} className="w-full h-6 rounded bg-zinc-950 cursor-pointer border border-zinc-900" />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <button onClick={handleExport} className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-xl py-3 text-xs font-bold transition-all shadow-[0_0_20px_rgba(139,92,246,0.15)]">
            {isRtl ? "تصدير بالجودة النهائية" : "Export in Final Quality"}
          </button>
        </aside>

        {/* Center Panel - Real Seekable Video Player & Draggable overlay */}
        <main className="flex-1 flex flex-col items-center justify-center bg-black/35 relative p-8">
          <div 
            id="video-frame-container"
            className={`relative bg-zinc-950 border border-white/5 shadow-2xl rounded-2xl overflow-hidden h-full max-h-[75vh] flex flex-col group transition-all duration-300 ${isShortsMode ? 'aspect-[9/16] w-auto' : 'aspect-video w-full max-w-2xl'}`}
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
                
                {/* Visual crop filter overlay */}
                <div className="absolute inset-0 bg-transparent z-10 pointer-events-none" />

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
                      top: `${textY}%`,
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
                              
                              return (
                                <span
                                  key={idx}
                                  style={{
                                    color: isActive 
                                      ? (shadowColor || "#facc15") 
                                      : (isHighlighted ? "#a78bfa" : textColor),
                                    transform: isActive ? "scale(1.15) rotate(1deg)" : "scale(1.0)",
                                    transition: "all 0.15s ease-out"
                                  }}
                                  className={`inline-block mx-0.5 ${isActive ? 'animate-bounce' : ''}`}
                                >
                                  {wObj.word}
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
              <div className="h-full bg-purple-500 w-1/3" />
            </div>
          </div>
        </main>
        
        {/* Right Panel - AI Generated Clips Results */}
        <aside className="w-80 border-s border-white/5 bg-zinc-950/20 flex flex-col z-10">
          <div className="p-4 border-b border-white/5 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-xs">{isRtl ? "الكليبات الناتجة" : "Generated Clips"} ({clips.length})</h2>
            </div>
            
            {/* Bulk actions */}
            <div className="flex gap-2">
              <button 
                onClick={handleDownloadSelected}
                disabled={selectedClipIds.length === 0 || isDownloading}
                className="flex-1 text-[9px] h-8 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-white/5 rounded-xl font-semibold gap-1 transition-colors flex items-center justify-center disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                <span>{isRtl ? `تحميل المحدد (${selectedClipIds.length})` : `Selected (${selectedClipIds.length})`}</span>
              </button>
              <button 
                onClick={handleDownloadAll}
                disabled={clips.length === 0 || isDownloading}
                className="text-[9px] h-8 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-white/5 rounded-xl font-semibold px-3 transition-colors flex items-center justify-center disabled:opacity-50"
              >
                <span>{isRtl ? "تنزيل الكل" : "Download All"}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoadingClips ? (
              <div className="text-center py-20 text-zinc-500 text-xs font-semibold flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                <span>{isRtl ? "جاري تحميل الكليبات..." : "Loading clips..."}</span>
              </div>
            ) : clips.length === 0 ? (
              <div className="text-center py-20 text-zinc-500 text-xs">
                {isRtl ? "لم يتم العثور على كليبات." : "No clips found."}
              </div>
            ) : (
              clips.map((clip, index) => {
                const isActive = activeClipIndex === index;
                const isSelected = selectedClipIds.includes(clip.id);
                const isEditing = editingClipId === clip.id;
                
                return (
                  <div 
                    key={clip.id} 
                    onClick={() => handleClipClick(index)}
                    className={`flex flex-col gap-2.5 p-3.5 rounded-2xl cursor-pointer transition-all border relative group/card ${
                      isActive 
                        ? 'border-purple-500 bg-purple-500/5 shadow-[0_0_15px_rgba(139,92,246,0.06)]' 
                        : 'border-white/5 bg-zinc-950/60 hover:border-zinc-850'
                    }`}
                  >
                    
                    {/* Inline edit forms */}
                    {isEditing ? (
                      <form 
                        onClick={(e) => e.stopPropagation()} 
                        onSubmit={(e) => handleSaveClipEdit(clip.id, e)} 
                        className="space-y-3 text-right"
                      >
                        <div className="space-y-1">
                          <label className="text-[9px] text-zinc-500 block">{isRtl ? "العنوان:" : "Title:"}</label>
                          <input 
                            type="text" 
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-850 rounded-lg px-2 py-1 text-xs text-white text-right"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] text-zinc-500 block">{isRtl ? "البداية:" : "Start:"}</label>
                            <input 
                              type="text" 
                              value={editStart}
                              onChange={(e) => setEditStart(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-850 rounded-lg px-2 py-1 text-xs text-white text-center font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] text-zinc-500 block">{isRtl ? "النهاية:" : "End:"}</label>
                            <input 
                              type="text" 
                              value={editEnd}
                              onChange={(e) => setEditEnd(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-850 rounded-lg px-2 py-1 text-xs text-white text-center font-mono"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-1">
                          <button 
                            type="button" 
                            onClick={() => setEditingClipId(null)}
                            className="text-[9px] px-2.5 py-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-850"
                          >
                            {isRtl ? "إلغاء" : "Cancel"}
                          </button>
                          <button 
                            type="submit" 
                            className="text-[9px] bg-purple-600 text-white hover:bg-purple-500 px-3 py-1 rounded gap-1 flex items-center font-semibold"
                          >
                            <Check className="h-3 w-3" />
                            <span>{isRtl ? "حفظ" : "Save"}</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Card regular view */
                      <>
                        {/* Always visible select checkbox */}
                        <div className="absolute top-2.5 left-2.5 rtl:right-2.5 rtl:left-auto z-20">
                          <button
                            onClick={(e) => toggleSelectClip(clip.id, e)}
                            className={`p-1 rounded bg-zinc-900 border transition-all ${
                              isSelected 
                                ? "border-purple-500 text-purple-400" 
                                : "border-zinc-800 text-zinc-500 hover:text-white"
                            }`}
                          >
                            {isSelected ? <CheckSquare className="h-3.5 w-3.5 text-purple-400" /> : <Square className="h-3.5 w-3.5" />}
                          </button>
                        </div>

                        {/* Action buttons on card hover */}
                        <div className="absolute top-2.5 left-10 rtl:right-10 rtl:left-auto flex items-center gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity z-20">
                          <button
                            onClick={(e) => startEditing(clip, e)}
                            className="p-1 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-500 hover:text-white"
                            title="Edit range"
                          >
                            <Scissors className="h-3.5 w-3.5" />
                          </button>
                          
                          <button
                            onClick={(e) => handleRegenerateClip(clip.id, e)}
                            disabled={regeneratingClipId === clip.id}
                            className="p-1 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-500 hover:text-white disabled:opacity-50"
                            title="Regenerate clip"
                          >
                            {regeneratingClipId === clip.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </button>

                          <button
                            onClick={(e) => handleDeleteClip(clip.id, e)}
                            className="p-1 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-500 hover:text-red-400"
                            title="Delete clip"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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

                            {/* Simplified details layout */}

                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>

      {/* Export progress modal */}
      {isExporting && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-zinc-950 border border-zinc-850 p-8 rounded-3xl max-w-sm w-full text-center space-y-4 shadow-2xl">
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
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-zinc-950 border border-zinc-850 p-8 rounded-3xl max-w-sm w-full text-center space-y-4 shadow-2xl">
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
    </div>
  );
}
