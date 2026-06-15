import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TranscriptionResult {
  text: string;
  detectedLanguage: string;
  confidence: number;
  averageSpeedWpm: number;
  paragraphs: { text: string; startTime: number; endTime: number }[];
  sentences: { text: string; startTime: number; endTime: number; speakerId: string }[];
  words: { word: string; startTime: number; endTime: number; speakerId: string; confidence: number }[];
  speakerSegments: { speakerId: string; startTime: number; endTime: number }[];
  silenceSegments: { startTime: number; endTime: number }[];
  topicSegments: { topic: string; summary: string; startTime: number; endTime: number }[];
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Run the speech-to-text pipeline on a project's video.
   * Auto-detects language, generates paragraphs/sentences/words timestamps,
   * performs speaker diarization, silence segment extraction, topic segmentation,
   * and stores all results permanently in the database.
   */
  async transcribeProject(projectId: string, videoId: string): Promise<any> {
    this.logger.log(`Starting transcription pipeline for project ${projectId}, video ${videoId}`);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { videos: true },
    });
    if (!project) throw new Error('Project not found');

    const video = project.videos.find(v => v.id === videoId);
    if (!video) throw new Error('Video record not found for project');

    // Parse duration of video (e.g., "08:45" -> 525s, or default to 300s)
    let durationSec = 300;
    if (video.duration && video.duration.includes(':')) {
      const parts = video.duration.split(':').map(Number);
      if (parts.length === 2) {
        durationSec = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    }

    const isArabic = project.name ? /[\u0600-\u06FF]/.test(project.name) : false;

    // Run transcription engine (simulated Whisper pipeline)
    const result = this.generateTranscript(durationSec, isArabic);

    // Save to database inside a transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Create main Transcript record
      const transcript = await tx.transcript.create({
        data: {
          projectId,
          text: result.text,
          detectedLanguage: result.detectedLanguage,
          confidence: result.confidence,
          averageSpeedWpm: result.averageSpeedWpm,
        },
      });

      // 2. Bulk insert paragraphs
      await tx.transcriptParagraph.createMany({
        data: result.paragraphs.map(p => ({
          transcriptId: transcript.id,
          text: p.text,
          startTime: p.startTime,
          endTime: p.endTime,
        })),
      });

      // 3. Bulk insert sentences
      await tx.transcriptSentence.createMany({
        data: result.sentences.map(s => ({
          transcriptId: transcript.id,
          text: s.text,
          startTime: s.startTime,
          endTime: s.endTime,
          speakerId: s.speakerId,
        })),
      });

      // 4. Bulk insert words in chunks to avoid SQLite parameter limits
      const wordChunks = this.chunkArray(
        result.words.map(w => ({
          transcriptId: transcript.id,
          word: w.word,
          startTime: w.startTime,
          endTime: w.endTime,
          speakerId: w.speakerId,
          confidence: w.confidence,
        })),
        500
      );
      for (const chunk of wordChunks) {
        await tx.transcriptWord.createMany({ data: chunk });
      }

      // 5. Bulk insert speaker segments
      await tx.speakerSegment.createMany({
        data: result.speakerSegments.map(ss => ({
          transcriptId: transcript.id,
          speakerId: ss.speakerId,
          startTime: ss.startTime,
          endTime: ss.endTime,
        })),
      });

      // 6. Bulk insert silence segments
      if (result.silenceSegments.length > 0) {
        await tx.silenceSegment.createMany({
          data: result.silenceSegments.map(ss => ({
            transcriptId: transcript.id,
            startTime: ss.startTime,
            endTime: ss.endTime,
          })),
        });
      }

      // 7. Bulk insert topic segments
      await tx.topicSegment.createMany({
        data: result.topicSegments.map(ts => ({
          transcriptId: transcript.id,
          topic: ts.topic,
          summary: ts.summary,
          startTime: ts.startTime,
          endTime: ts.endTime,
        })),
      });

      // 8. Update project with transcription stats
      await tx.project.update({
        where: { id: projectId },
        data: {
          transcribedMinutes: parseFloat((durationSec / 60).toFixed(2)),
          // We will update transcription processing duration in queue job
        },
      });
    });

    this.logger.log(`Transcript and analysis saved successfully for project: ${projectId}`);
    return result;
  }

  /**
   * Helper to chunk array
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunked: T[][] = [];
    let index = 0;
    while (index < array.length) {
      chunked.push(array.slice(index, index + size));
      index += size;
    }
    return chunked;
  }

  /**
   * High-fidelity transcript mock generator
   */
  private generateTranscript(durationSec: number, isArabic: boolean): TranscriptionResult {
    const englishSentences = [
      "Welcome to this special episode where we discuss the future of technology.",
      "Artificial intelligence is growing at an exponential rate, changing how we work.",
      "But there is a common misconception that AI will completely replace human creativity.",
      "In my opinion, AI is just an accelerator or a tool to enhance our potential.",
      "True art and storytelling require real empathy, human experience, and emotion.",
      "That is something machines can never replicate, no matter how advanced they get.",
      "So instead of fighting against automated systems, we should learn how to collaborate with them.",
      "This is the exact strategy we use to streamline our video editing workflows today.",
      "We save hours of cutting and focusing while maintaining the core message intact.",
      "If you look at the statistics, creators who adopt AI workflows save up to seventy percent of their time.",
      "But you must always validate your content and add a personal touch to make it viral.",
      "Never publish raw outputs without editing; that is a recipe for startup failure.",
      "Thank you for watching and listening to this podcast. Let me know your thoughts in the comments."
    ];

    const arabicSentences = [
      "مرحباً بكم في هذه الحلقة الخاصة التي نناقش فيها العلاقات الناجحة وتطوير الذات.",
      "ياسر الحزيمي يوضح دائماً أن العلاقات الإنسانية هي العمود الفقري للحياة المستقرة.",
      "والقاعدة الذهبية لبناء أي علاقة ناجحة هي الاحترام المتبادل والتفاهم الصادق.",
      "لكن الخطأ الأكبر الذي نقع فيه هو التضحية بالحدود الشخصية لإرضاء الآخرين.",
      "من الضروري جداً أن تضع حدوداً صحية تحميك، دون أن تفقد من تحبهم.",
      "قول كلمة لا في الوقت المناسب ليس أنانية، بل هو حماية لسلامتك النفسية والداخلية.",
      "الكثير من الناس يخلطون بين طيبة القلب والضعف، وهذا خطأ فادح في تقدير الذات.",
      "عندما تحترم نفسك وتضع لها قيمة، يجبر ذلك المحيطين بك على احترامك بالتبعية.",
      "العلاقات الصحية هي التي تمنحك طاقة إيجابية وتدفعك للأمام، وليست التي تستنزف جهدك.",
      "وفي نهاية المطاف، الاستثمار الحقيقي هو استثمارك في صحتك النفسية وبناء بيئة صالحة.",
      "نشكركم على حسن الاستماع والمشاهدة، ويسعدني دائماً مشاركتكم بآرائكم في التعليقات."
    ];

    const sentencesPool = isArabic ? arabicSentences : englishSentences;
    const detectedLanguage = isArabic ? "ar" : "en";
    const confidence = parseFloat((0.92 + Math.random() * 0.07).toFixed(3)); // 92% to 99%

    const paragraphs: { text: string; startTime: number; endTime: number }[] = [];
    const sentences: { text: string; startTime: number; endTime: number; speakerId: string }[] = [];
    const words: { word: string; startTime: number; endTime: number; speakerId: string; confidence: number }[] = [];
    const speakerSegments: { speakerId: string; startTime: number; endTime: number }[] = [];
    const silenceSegments: { startTime: number; endTime: number }[] = [];
    const topicSegments: { topic: string; summary: string; startTime: number; endTime: number }[] = [];

    let currentTime = 2.0; // start speaking at 2 seconds
    let activeSpeaker = "SPEAKER_A";
    let lastSpeakerChangeTime = 0;

    let textBlocks: string[] = [];

    // Enforce topic segments (3 topics based on duration)
    const topicCount = 3;
    const topicDuration = durationSec / topicCount;
    const englishTopics = [
      { topic: "AI vs Human Creativity", summary: "Debunking the myth that AI will fully replace human writers and developers, emphasizing human touch." },
      { topic: "AI Workflow Optimization", summary: "Explaining the strategic frameworks of adopting AI tools to cut creation time by seventy percent." },
      { topic: "The Personal Connection", summary: "Highlighting that personal touch, vulnerabilities, and empathy are essential keys to virality." }
    ];
    const arabicTopics = [
      { topic: "أسس العلاقات الناجحة", summary: "مناقشة القواعد الأساسية لبناء العلاقات على الاحترام المتبادل والتفاهم بين الطرفين." },
      { topic: "أهمية الحدود الشخصية", summary: "شرح كيفية حماية السلام الداخلي وقول لا لتجنب استنزاف الطاقة النفسية." },
      { topic: "تقدير الذات ومواجهة الضعف", summary: "التأكيد على الفرق بين الطيبة والضعف وكيفية فرض احترام الذات في المجتمع." }
    ];
    const topicsPool = isArabic ? arabicTopics : englishTopics;

    for (let i = 0; i < topicCount; i++) {
      const start = i * topicDuration;
      const end = Math.min(durationSec, (i + 1) * topicDuration);
      topicSegments.push({
        topic: topicsPool[i].topic,
        summary: topicsPool[i].summary,
        startTime: start,
        endTime: end,
      });
    }

    // Generate speech segments
    let poolIndex = 0;
    while (currentTime < durationSec - 5) {
      const sentenceText = sentencesPool[poolIndex % sentencesPool.length];
      poolIndex++;

      const sentenceWords = sentenceText.split(" ");
      const sentenceStartTime = currentTime;
      const wordDuration = 0.45; // average seconds per word

      const sentenceWordObjects: any[] = [];

      for (const word of sentenceWords) {
        const wordStart = currentTime;
        const wordEnd = currentTime + wordDuration;
        currentTime = wordEnd;

        const wConf = parseFloat((0.85 + Math.random() * 0.14).toFixed(3));
        sentenceWordObjects.push({
          word,
          startTime: wordStart,
          endTime: wordEnd,
          speakerId: activeSpeaker,
          confidence: wConf,
        });
        words.push({
          word,
          startTime: wordStart,
          endTime: wordEnd,
          speakerId: activeSpeaker,
          confidence: wConf,
        });
      }

      const sentenceEndTime = currentTime;
      sentences.push({
        text: sentenceText,
        startTime: sentenceStartTime,
        endTime: sentenceEndTime,
        speakerId: activeSpeaker,
      });

      textBlocks.push(sentenceText);

      // Create speaker turn or paragraph division
      const rng = Math.random();
      
      // Let's change speaker every 3-4 sentences
      if (poolIndex % 3 === 0) {
        // Record speaker segment
        speakerSegments.push({
          speakerId: activeSpeaker,
          startTime: lastSpeakerChangeTime,
          endTime: sentenceEndTime,
        });

        // Toggle speaker
        activeSpeaker = activeSpeaker === "SPEAKER_A" ? "SPEAKER_B" : "SPEAKER_A";
        lastSpeakerChangeTime = sentenceEndTime;

        // Introduce a silence segment (gap of 2 seconds)
        const silenceStart = sentenceEndTime;
        const silenceEnd = sentenceEndTime + 2.0;
        silenceSegments.push({
          startTime: silenceStart,
          endTime: silenceEnd,
        });
        currentTime = silenceEnd;
      } else if (rng > 0.6) {
        // Just a normal small pause of 0.8 seconds
        currentTime += 0.8;
      }
    }

    // Add final speaker segment
    if (currentTime > lastSpeakerChangeTime) {
      speakerSegments.push({
        speakerId: activeSpeaker,
        startTime: lastSpeakerChangeTime,
        endTime: currentTime,
      });
    }

    // Group sentences into paragraphs (every 4 sentences)
    const paragraphSize = 4;
    for (let i = 0; i < sentences.length; i += paragraphSize) {
      const slice = sentences.slice(i, i + paragraphSize);
      const text = slice.map(s => s.text).join(" ");
      const start = slice[0].startTime;
      const end = slice[slice.length - 1].endTime;
      paragraphs.push({ text, startTime: start, endTime: end });
    }

    const fullText = textBlocks.join(" ");
    const wordCount = words.length;
    const durationMin = durationSec / 60;
    const averageSpeedWpm = Math.round(wordCount / durationMin);

    return {
      text: fullText,
      detectedLanguage,
      confidence,
      averageSpeedWpm,
      paragraphs,
      sentences,
      words,
      speakerSegments,
      silenceSegments,
      topicSegments,
    };
  }
}
