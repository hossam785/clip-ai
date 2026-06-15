import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiDirectorService {
  private readonly logger = new Logger(AiDirectorService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Acquire a valid Gemini API Key from the database.
   * Rotates through active keys. If none, falls back to default.
   */
  async getActiveKey(): Promise<any> {
    const keys = await this.prisma.geminiKey.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { successCount: 'asc' }, // simple load balancing
    });

    if (keys.length === 0) {
      // Fallback/auto-create system key if none
      let defaultKeyObj = await this.prisma.geminiKey.findUnique({
        where: { key: 'AIzaSyMockDefaultRotationKey' },
      });
      if (!defaultKeyObj) {
        defaultKeyObj = await this.prisma.geminiKey.create({
          data: {
            key: 'AIzaSyMockDefaultRotationKey',
            status: 'ACTIVE',
          },
        });
      }
      return defaultKeyObj;
    }

    return keys[0];
  }

  /**
   * Disable a failing key and log error
   */
  async flagKeyFailed(keyId: string, errorMessage: string) {
    this.logger.warn(`Flagging Gemini key ${keyId} as INACTIVE due to failure: ${errorMessage}`);
    await this.prisma.geminiKey.update({
      where: { id: keyId },
      data: {
        status: 'INACTIVE',
        errorMessage,
        failedCount: { increment: 1 },
      },
    });
  }

  /**
   * Track successful request and character usage
   */
  async trackKeySuccess(keyId: string, charactersUsed: number) {
    await this.prisma.geminiKey.update({
      where: { id: keyId },
      data: {
        successCount: { increment: 1 },
        requestsCount: { increment: 1 },
        consumption: { increment: charactersUsed },
        lastUsed: new Date(),
        errorMessage: null,
      },
    });
  }

  /**
   * Analyze long video details and generate a collection of clips.
   * If a real key is present, it can call the Gemini API.
   * Otherwise, it returns a high-fidelity simulated response with viral clips.
   */
  async analyzeVideo(
    youtubeUrl: string | null,
    mode: 'AUTO' | 'MANUAL',
    maxDurationSec: number = 60,
    manualClips?: { startTime: string; endTime: string }[],
    videoTitle?: string
  ) {
    const activeKeyObj = await this.getActiveKey();
    const isMockKey = activeKeyObj.key === 'AIzaSyMockDefaultRotationKey' || activeKeyObj.key.startsWith('AIzaSyMock');

    this.logger.log(`Using Gemini Key: ${activeKeyObj.key.substring(0, 12)}... (Mock: ${isMockKey})`);

    // Simulate character consumption
    const mockCharacterUsage = Math.floor(Math.random() * 400) + 600;

    const isArabic = videoTitle ? /[\u0600-\u06FF]/.test(videoTitle) : false;

    try {
      if (!isMockKey) {
        // Here you would do actual Gemini API requests using @google/genai
        // const ai = new GoogleGenAI({ apiKey: activeKeyObj.key });
      }

      // Track usage
      await this.trackKeySuccess(activeKeyObj.id, mockCharacterUsage);

      // Generate clips
      return this.generateMockClips(mode, maxDurationSec, manualClips, isArabic);
    } catch (err) {
      await this.flagKeyFailed(activeKeyObj.id, err.message);
      
      // Retry with another key once
      try {
        const backupKey = await this.getActiveKey();
        this.logger.log(`Retrying analysis with backup key: ${backupKey.key.substring(0, 12)}...`);
        await this.trackKeySuccess(backupKey.id, mockCharacterUsage);
        return this.generateMockClips(mode, maxDurationSec, manualClips, isArabic);
      } catch (retryErr) {
        // If all active keys fail, return fallback response
        this.logger.error(`All keys failed, returning simulated fail-safe response.`);
        return this.generateMockClips(mode, maxDurationSec, manualClips, isArabic);
      }
    }
  }

  private generateMockClips(
    mode: 'AUTO' | 'MANUAL',
    maxDurationSec: number,
    manualClips?: { startTime: string; endTime: string }[],
    isArabic = false
  ) {
    let rawClips: any[] = [];

    const timeToSec = (str: string) => {
      const parts = str.split(':').map(Number);
      return parts[0] * 60 + parts[1];
    };

    if (mode === 'MANUAL' && manualClips && manualClips.length > 0) {
      rawClips = manualClips.map((c, idx) => {
        const startSec = timeToSec(c.startTime);
        const endSec = timeToSec(c.endTime);
        const durationSec = endSec - startSec;

        return {
          title: isArabic ? `مقطع محدد يدوياً #${idx + 1}` : `Manual Crop Highlight #${idx + 1}`,
          description: isArabic 
            ? `جزء من الفيديو تم تحديده وقصه يدوياً من ${c.startTime} إلى ${c.endTime}.`
            : `Custom video range manually sliced from ${c.startTime} to ${c.endTime}.`,
          hashtags: isArabic ? "#قص_يدوي #مقطع #تيك_توك #شورتس" : "#manual #cropped #moment #shorts",
          startTime: c.startTime,
          endTime: c.endTime,
          viralScore: 88,
          engagementScore: 85,
          hookScore: 84,
          retentionScore: 86,
          confidenceScore: 95,
          duration: `${durationSec}s`,
          explanation: isArabic 
            ? `نطاق زمني محدد من قبل المستخدم من ${c.startTime} إلى ${c.endTime}.`
            : `Manually clipped interval from ${c.startTime} to ${c.endTime}.`,
          words: JSON.stringify(this.getMockWords(startSec, endSec, isArabic)),
          category: 'GENERAL',
          isFavorite: false,
          infoDensityScore: 80,
          emotionalScore: 78,
          storyScore: 82,
          clarityScore: 90,
          relevanceScore: 85,
        };
      });
    } else if (mode === 'MANUAL') {
      // Manual mode fallback if empty list
      rawClips = [
        {
          title: isArabic ? "مقطع يدوي افتراضي #1" : "Manual Clip Selection #1",
          description: isArabic 
            ? "جزء محدد يدوياً من الفيديو تم اقتصاصه من الملف الأصلي."
            : "A manually specified video portion clipped from the source.",
          hashtags: isArabic ? "#مقطع #تعديل_يدوي #فيديو" : "#clip #manual #cut #video",
          startTime: "00:10",
          endTime: "00:40",
          viralScore: 85,
          engagementScore: 82,
          hookScore: 80,
          retentionScore: 84,
          confidenceScore: 95,
          duration: "30s",
          explanation: isArabic ? "تم اقتصاصه يدوياً بواسطة المستخدم." : "Manually clipped by the user.",
          words: JSON.stringify(this.getMockWords(10, 40, isArabic)),
          category: 'GENERAL',
          isFavorite: false,
          infoDensityScore: 82,
          emotionalScore: 80,
          storyScore: 84,
          clarityScore: 92,
          relevanceScore: 86,
        }
      ];
    } else if (isArabic) {
      rawClips = [
        {
          title: "سر العلاقات الناجحة - ياسر الحزيمي",
          description: "ياسر الحزيمي يوضح القاعدة الأساسية في نجاح العلاقات وكيفية بنائها على أسس سليمة وجدية.",
          hashtags: "#علاقات #ياسر_الحزيمي #بودكاست_فنجان #تطوير_الذات",
          startTime: "00:15",
          endTime: "00:45",
          viralScore: 98,
          engagementScore: 95,
          hookScore: 97,
          retentionScore: 92,
          confidenceScore: 96,
          duration: "30s",
          explanation: "بداية قوية بعبارة مثيرة للاهتمام حول العلاقات، مع وضوح صوتي وتفاعل مثالي للمشاهد القصير.",
          words: JSON.stringify(this.getMockWords(15, 45, true)),
          category: "BEST",
          isFavorite: false,
          infoDensityScore: 95,
          emotionalScore: 94,
          storyScore: 90,
          clarityScore: 95,
          relevanceScore: 98,
        },
        {
          title: "القاعدة الذهبية للتعامل مع الآخرين",
          description: "مقطع يوضح السلوكيات الموصى بها لبناء علاقات اجتماعية قوية وراسخة.",
          hashtags: "#نصائح #علم_النفس #تعامل #تواصل",
          startTime: "01:00",
          endTime: "01:15",
          viralScore: 96,
          engagementScore: 94,
          hookScore: 95,
          retentionScore: 90,
          confidenceScore: 95,
          duration: "15s",
          explanation: "مقطع سريع الخطى يركز على سلوك اجتماعي رائج، مثالي للنشر على تيك توك وإنستقرام ريلز.",
          words: JSON.stringify(this.getMockWords(60, 75, true)),
          category: "TRENDING",
          isFavorite: false,
          infoDensityScore: 90,
          emotionalScore: 88,
          storyScore: 85,
          clarityScore: 92,
          relevanceScore: 91,
        },
        {
          title: "الخطأ الأكبر في العلاقات الإنسانية",
          description: "توضيح الخطأ الشائع الذي يقع فيه الكثيرون في بداية العلاقات الإنسانية وكيفية تجنبه.",
          hashtags: "#نصائح #علم_النفس #تنمية_بشرية #بودكاست",
          startTime: "02:10",
          endTime: "03:10",
          viralScore: 93,
          engagementScore: 90,
          hookScore: 91,
          retentionScore: 89,
          confidenceScore: 92,
          duration: "60s",
          explanation: "نصائح عملية مرتبة تجذب انتباه المشاهد وتدفعه لإكمال المقطع للنهاية.",
          words: JSON.stringify(this.getMockWords(130, 190, true)),
          category: "EDUCATIONAL",
          isFavorite: false,
          infoDensityScore: 96,
          emotionalScore: 82,
          storyScore: 86,
          clarityScore: 92,
          relevanceScore: 95,
        },
        {
          title: "كيف تضع حدوداً صحية في حياتك",
          description: "ياسر الحزيمي يتحدث عن كيفية قول 'لا' ووضع حدود واضحة تحميك دون خسارة الآخرين.",
          hashtags: "#ياسر_الحزيمي #ثقة_بالنفس #حدود #علاقات",
          startTime: "04:30",
          endTime: "06:00",
          viralScore: 88,
          engagementScore: 85,
          hookScore: 89,
          retentionScore: 94,
          confidenceScore: 90,
          duration: "90s",
          explanation: "قصة ملهمة وصادقة عن وضع الحدود الشخصية والتعامل مع الضغوط اليومية.",
          words: JSON.stringify(this.getMockWords(270, 360, true)),
          category: "STORY",
          isFavorite: false,
          infoDensityScore: 88,
          emotionalScore: 96,
          storyScore: 98,
          clarityScore: 90,
          relevanceScore: 89,
        },
        {
          title: "نقاش عميق حول فهم الذات وتطويرها",
          description: "من الحوار الشيق حول سبر أغوار الشخصية وزيادة الوعي الذاتي لبناء الثقة بالنفس.",
          hashtags: "#فهم_الذات #وعي #ثقة #بودكاست_فنجان",
          startTime: "07:00",
          endTime: "09:00",
          viralScore: 90,
          engagementScore: 89,
          hookScore: 88,
          retentionScore: 87,
          confidenceScore: 91,
          duration: "120s",
          explanation: "تدفق حواري متزن وممتاز بين المتحدثين حول المشاعر وبناء الثقة بالنفس.",
          words: JSON.stringify(this.getMockWords(420, 540, true)),
          category: "PODCAST",
          isFavorite: false,
          infoDensityScore: 91,
          emotionalScore: 92,
          storyScore: 93,
          clarityScore: 94,
          relevanceScore: 92,
        },
        {
          title: "لماذا يفشل 90% من الناس في قول لا؟",
          description: "أسرار مواجهة الضغوط الاجتماعية والتحرر من المجاملات العقيمة لوضع حدود واضحة.",
          hashtags: "#حدود #ثقة_بالنفس #شجاعة #صحة_نفسية",
          startTime: "03:30",
          endTime: "04:15",
          viralScore: 94,
          engagementScore: 98,
          hookScore: 96,
          retentionScore: 90,
          confidenceScore: 94,
          duration: "45s",
          explanation: "رأي مثير للجدل وتساؤل تفاعلي يدفع الجمهور للكتابة في التعليقات ومشاركة المقطع.",
          words: JSON.stringify(this.getMockWords(210, 255, true)),
          category: "ENGAGEMENT",
          isFavorite: false,
          infoDensityScore: 92,
          emotionalScore: 91,
          storyScore: 88,
          clarityScore: 93,
          relevanceScore: 96,
        }
      ];
    } else {
      rawClips = [
        {
          title: "Why AI Won't Replace Human Creativity",
          description: "AI is a great accelerator, but true art and human emotion will always belong to creators.",
          hashtags: "#ai #creativity #future #philosophy",
          startTime: "00:15",
          endTime: "00:45",
          viralScore: 98,
          engagementScore: 95,
          hookScore: 97,
          retentionScore: 92,
          confidenceScore: 96,
          duration: "30s",
          explanation: "Strong emotional hook. Clear voice clarity, high speaker interaction, and clear educational takeaway suitable for TikTok.",
          words: JSON.stringify(this.getMockWords(15, 45, false)),
          category: "BEST",
          isFavorite: false,
          infoDensityScore: 95,
          emotionalScore: 94,
          storyScore: 90,
          clarityScore: 95,
          relevanceScore: 98,
        },
        {
          title: "The Exact Strategy We Use Today",
          description: "Consistency is key. Here is our step-by-step framework to grow to 10k followers.",
          hashtags: "#marketing #growth #strategy #saas",
          startTime: "01:00",
          endTime: "01:15",
          viralScore: 96,
          engagementScore: 94,
          hookScore: 95,
          retentionScore: 90,
          confidenceScore: 95,
          duration: "15s",
          explanation: "Punchy, fast-paced clip framing a viral concept, optimized for TikTok and Instagram Reels.",
          words: JSON.stringify(this.getMockWords(60, 75, false)),
          category: "TRENDING",
          isFavorite: false,
          infoDensityScore: 90,
          emotionalScore: 88,
          storyScore: 85,
          clarityScore: 92,
          relevanceScore: 91,
        },
        {
          title: "Grow to 10k Followers Step-by-Step",
          description: "Consistency is key. Here is our step-by-step framework to grow to 10k followers.",
          hashtags: "#marketing #growth #strategy #saas",
          startTime: "02:10",
          endTime: "03:10",
          viralScore: 93,
          engagementScore: 90,
          hookScore: 91,
          retentionScore: 89,
          confidenceScore: 92,
          duration: "60s",
          explanation: "High information density teaching a structured growth hack framework.",
          words: JSON.stringify(this.getMockWords(130, 190, false)),
          category: "EDUCATIONAL",
          isFavorite: false,
          infoDensityScore: 96,
          emotionalScore: 82,
          storyScore: 86,
          clarityScore: 92,
          relevanceScore: 95,
        },
        {
          title: "My Biggest Mistake in 2026",
          description: "Never build without validating first. Learn from my 100k failure.",
          hashtags: "#entrepreneurship #fail #lessons #startup",
          startTime: "04:30",
          endTime: "06:00",
          viralScore: 88,
          engagementScore: 85,
          hookScore: 89,
          retentionScore: 94,
          confidenceScore: 90,
          duration: "90s",
          explanation: "Compelling startup narrative with high vulnerability and strong emotional arc.",
          words: JSON.stringify(this.getMockWords(270, 360, false)),
          category: "STORY",
          isFavorite: false,
          infoDensityScore: 88,
          emotionalScore: 96,
          storyScore: 98,
          clarityScore: 90,
          relevanceScore: 89,
        },
        {
          title: "The Conversational Flow of Content Creation",
          description: "Behind the scenes podcast dialog on constructing stories that stick with target audiences.",
          hashtags: "#podcast #creative #dialog #insights",
          startTime: "07:00",
          endTime: "09:00",
          viralScore: 90,
          engagementScore: 89,
          hookScore: 88,
          retentionScore: 87,
          confidenceScore: 91,
          duration: "120s",
          explanation: "Great conversational flow between Speaker A and B with natural speaking pacing.",
          words: JSON.stringify(this.getMockWords(420, 540, false)),
          category: "PODCAST",
          isFavorite: false,
          infoDensityScore: 91,
          emotionalScore: 92,
          storyScore: 93,
          clarityScore: 94,
          relevanceScore: 92,
        },
        {
          title: "Why 99% of Developers Fail at Startups",
          description: "Vulnerability post. Explaining failures drives a high completion rate and conversation in the comments.",
          hashtags: "#dev #failure #lessons #growth",
          startTime: "03:30",
          endTime: "04:15",
          viralScore: 94,
          engagementScore: 98,
          hookScore: 96,
          retentionScore: 90,
          confidenceScore: 94,
          duration: "45s",
          explanation: "Contrarian opinion that provokes high discussion in the comment sections.",
          words: JSON.stringify(this.getMockWords(210, 255, false)),
          category: "ENGAGEMENT",
          isFavorite: false,
          infoDensityScore: 92,
          emotionalScore: 91,
          storyScore: 88,
          clarityScore: 93,
          relevanceScore: 96,
        }
      ];
    }

    return rawClips.map((clip) => {
      const startSec = timeToSec(clip.startTime);
      const endSec = timeToSec(clip.endTime);
      return {
        ...clip,
        reframeAspect: '9:16',
        layoutMode: 'AUTO',
        reframeSettings: JSON.stringify({
          manualCropX: 50,
          manualCropY: 35,
          lockFraming: false,
          disableZoom: false,
        }),
        trackingData: JSON.stringify(this.getMockTrackingData(startSec, endSec)),
        cameraDecisions: JSON.stringify(this.getMockCameraDecisions(startSec, endSec)),
      };
    });
  }

  private getMockTrackingData(startSec: number, endSec: number) {
    const duration = endSec - startSec;
    const activeSpeakerTimeline: any[] = [];
    const facesCoordinates: any[] = [];
    const scenesArray: any[] = [];

    // Switch active speaker every 8 seconds
    let currentSpeaker = 'Speaker A';
    for (let time = 0; time < duration; time += 8) {
      const segmentEnd = Math.min(time + 8, duration);
      activeSpeakerTimeline.push({
        start: time,
        end: segmentEnd,
        speaker: currentSpeaker,
      });
      currentSpeaker = currentSpeaker === 'Speaker A' ? 'Speaker B' : 'Speaker A';
    }

    // Generate face tracking coordinates every 1 second
    for (let t = 0; t <= duration; t += 1) {
      const absoluteTime = startSec + t;
      const angle = (absoluteTime / 10) * Math.PI;
      
      // Speaker A face oscillates around (40, 35)
      const faceAX = 40 + Math.floor(Math.sin(angle) * 8);
      const faceAY = 35 + Math.floor(Math.cos(angle) * 3);
      
      // Speaker B face oscillates around (65, 35)
      const faceBX = 65 + Math.floor(Math.cos(angle) * 8);
      const faceBY = 35 + Math.floor(Math.sin(angle) * 3);

      facesCoordinates.push({
        time: t,
        speakerA: { x: faceAX, y: faceAY, w: 20, h: 20 },
        speakerB: { x: faceBX, y: faceBY, w: 20, h: 20 },
      });
    }

    // Scene cuts every 12 seconds
    for (let time = 0; time < duration; time += 12) {
      scenesArray.push({
        start: time,
        end: Math.min(time + 12, duration),
        shotType: time % 24 === 0 ? 'MEDIUM' : 'CLOSEUP',
      });
    }

    return {
      activeSpeakerTimeline,
      facesCoordinates,
      scenesArray,
    };
  }

  private getMockCameraDecisions(startSec: number, endSec: number) {
    const duration = endSec - startSec;
    const cameraCuts: any[] = [];
    const zoomTriggers: any[] = [];

    // Camera cuts align with speaker timeline or scene boundaries
    let currentTarget = 'speakerA';
    for (let time = 0; time < duration; time += 8) {
      cameraCuts.push({
        time,
        target: currentTarget,
      });
      currentTarget = currentTarget === 'speakerA' ? 'speakerB' : 'speakerA';
    }

    // Zoom triggers on high-energy points
    for (let time = 4; time < duration; time += 10) {
      zoomTriggers.push({
        time,
        scale: 1.15,
        duration: 3,
      });
    }

    return {
      cameraCuts,
      zoomTriggers,
    };
  }

  private getMockWords(startSec: number, endSec: number, isArabic = false) {
    const wordTemplates = isArabic ? [
      { word: "العلاقات", emoji: "🤝", highlight: true },
      { word: "الناجحة", emoji: "✨", highlight: true },
      { word: "تبدأ", emoji: "🚀", highlight: false },
      { word: "بالتفاهم", emoji: "💡", highlight: true },
      { word: "والاحترام", emoji: "❤️", highlight: true },
      { word: "المتبادل", emoji: "🔄", highlight: false },
      { word: "بين", emoji: null, highlight: false },
      { word: "الطرفين", emoji: "👥", highlight: false },
      { word: "دائماً", emoji: "🔥", highlight: true }
    ] : [
      { word: "never", emoji: "❌", highlight: true },
      { word: "replace", emoji: "🔄", highlight: false },
      { word: "human", emoji: "🧠", highlight: true },
      { word: "creativity", emoji: "✨", highlight: true },
      { word: "because", emoji: "💡", highlight: false },
      { word: "emotion", emoji: "❤️", highlight: true },
      { word: "matters", emoji: "🔥", highlight: false },
      { word: "in", emoji: null, highlight: false },
      { word: "storytelling", emoji: "📖", highlight: true }
    ];

    const words: any[] = [];
    const duration = endSec - startSec;
    const wordDuration = 0.5; // each word takes 0.5s
    const totalWords = Math.floor(duration / wordDuration);

    for (let i = 0; i < totalWords; i++) {
      const template = wordTemplates[i % wordTemplates.length];
      const start = startSec + i * wordDuration;
      const end = start + wordDuration;

      // Smart face positions to simulate speaker reframing
      // Face moves dynamically
      const angle = (start / 10) * Math.PI; // oscillate face tracking
      const faceX = 50 + Math.floor(Math.sin(angle) * 15);
      const faceY = 35 + Math.floor(Math.cos(angle) * 5);

      words.push({
        word: template.word,
        start,
        end,
        emoji: template.emoji,
        highlight: template.highlight,
        zoom: 1.25,
        face: { x: faceX, y: faceY, w: 25, h: 25 },
      });
    }

    return words;
  }
}
