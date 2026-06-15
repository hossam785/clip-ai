import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiDirectorService } from '../ai-director/ai-director.service';
import { TranscriptionService } from './transcription.service';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly publicDir = path.join(__dirname, '..', '..', 'public');

  constructor(
    private prisma: PrismaService,
    private aiDirector: AiDirectorService,
    private transcriptionService: TranscriptionService,
  ) {}

  onModuleInit() {
    const processJobs = process.env.PROCESS_JOBS !== 'false';
    if (processJobs) {
      this.logger.log('Initializing background job queue runner loop...');
      // Run the queue poll every 4 seconds
      this.intervalId = setInterval(() => this.pollQueue(), 4000);
    } else {
      this.logger.log('Background job queue processing is disabled on this instance (PROCESS_JOBS is false).');
    }
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  /**
   * Poll database for queued background jobs
   */
  private async pollQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const nextJob = await this.prisma.backgroundJob.findFirst({
        where: { status: 'QUEUED' },
        orderBy: { createdAt: 'asc' },
      });

      if (nextJob) {
        // Atomic status lock to avoid race conditions and double execution in clusters
        const updateResult = await this.prisma.backgroundJob.updateMany({
          where: {
            id: nextJob.id,
            status: 'QUEUED',
          },
          data: {
            status: 'RUNNING',
            attempts: { increment: 1 },
          },
        });

        if (updateResult.count > 0) {
          const lockedJob = await this.prisma.backgroundJob.findUnique({
            where: { id: nextJob.id },
          });
          if (lockedJob) {
            await this.runJob(lockedJob);
          }
        }
      }
    } catch (err) {
      this.logger.error(`Error polling background jobs: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async addLog(jobId: string, message: string) {
    const job = await this.prisma.backgroundJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    let logs: string[] = [];
    try {
      logs = job.logs ? JSON.parse(job.logs) : [];
    } catch (e) {
      logs = [];
    }
    logs.push(`[${new Date().toISOString()}] ${message}`);
    await this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: { logs: JSON.stringify(logs) },
    });
  }

  private async runJob(job: any) {
    this.logger.log(`[QueueWorker] Executing job ${job.id} (Type: ${job.type})`);
    // Status is already marked RUNNING and attempts incremented in pollQueue atomically.
    await this.addLog(job.id, `Job status updated to RUNNING (Attempt ${job.attempts}/${job.maxAttempts})`);

    try {
      if (job.type === 'METADATA_EXTRACTION') {
        await this.handleMetadataExtraction(job);
      } else if (job.type === 'TRANSCRIPTION') {
        await this.handleTranscriptionJob(job);
      } else if (job.type === 'AI_PROCESSING_SIMULATION') {
        await this.handleAiProcessingSimulation(job);
      } else if (job.type === 'CLIP_EXPORT') {
        await this.handleClipExportJob(job);
      } else {
        throw new Error(`Unknown job type: ${job.type}`);
      }

      await this.prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED' },
      });
      await this.addLog(job.id, 'Job COMPLETED successfully');
    } catch (err) {
      this.logger.error(`[QueueWorker] Job ${job.id} failed: ${err.message}`);
      await this.addLog(job.id, `ERROR: ${err.message}`);

      const maxAttempts = job.maxAttempts ?? 3;
      if (job.attempts + 1 >= maxAttempts) {
        await this.prisma.backgroundJob.update({
          where: { id: job.id },
          data: { status: 'FAILED', error: err.message },
        });
        await this.addLog(job.id, `Job marked as FAILED after exceeding max attempts.`);
        
        // Update associated project status to FAILED
        await this.prisma.project.update({
          where: { id: job.projectId },
          data: { status: 'FAILED', processingState: 'FAILED' },
        });
      } else {
        await this.prisma.backgroundJob.update({
          where: { id: job.id },
          data: { status: 'QUEUED', error: err.message },
        });
        await this.addLog(job.id, `Job rescheduled to QUEUED for retry.`);
      }
    }
  }

  /**
   * Handle video metadata extraction and thumbnail generation
   */
  private async handleMetadataExtraction(job: any) {
    const video = await this.prisma.video.findUnique({ where: { id: job.videoId } });
    if (!video) throw new Error(`Video with ID ${job.videoId} not found`);

    const project = await this.prisma.project.findUnique({ where: { id: job.projectId } });
    if (!project) throw new Error(`Project with ID ${job.projectId} not found`);

    if (!video.localPath) throw new Error('Video has no local path to read metadata');

    const absoluteVideoPath = path.join(this.publicDir, video.localPath);
    if (!fs.existsSync(absoluteVideoPath)) {
      throw new Error(`Video file not found on storage: ${absoluteVideoPath}`);
    }

    await this.addLog(job.id, `Reading metadata for file: ${video.localPath}`);
    
    // Read file size
    const fileStats = fs.statSync(absoluteVideoPath);
    const sizeStr = `${(fileStats.size / (1024 * 1024)).toFixed(1)} MB`;
    await this.prisma.video.update({
      where: { id: video.id },
      data: { bytesSize: fileStats.size, size: sizeStr },
    });

    // Extract metadata using fluent-ffmpeg
    const metadata: any = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(absoluteVideoPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });

    const durationSec = metadata.format.duration || 0;
    const formatDuration = (sec: number) => {
      const minutes = Math.floor(sec / 60);
      const remainingSeconds = Math.floor(sec % 60);
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };
    const durationStr = formatDuration(durationSec);

    // Get resolution and fps
    const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
    const width = videoStream?.width ?? 1920;
    const height = videoStream?.height ?? 1080;
    const resolutionStr = `${width}x${height}`;
    const qualityStr = height >= 1080 ? '1080p Full HD' : height >= 720 ? '720p HD' : '480p SD';

    // Parse FPS
    let fps = 30;
    if (videoStream?.r_frame_rate) {
      const parts = videoStream.r_frame_rate.split('/');
      if (parts.length === 2) {
        fps = parseFloat(parts[0]) / parseFloat(parts[1]);
      } else {
        fps = parseFloat(videoStream.r_frame_rate);
      }
    }

    await this.addLog(job.id, `Extracted: Duration=${durationStr}, Res=${resolutionStr}, FPS=${fps.toFixed(2)}`);

    // Generate Thumbnail snapshot
    const thumbnailName = `${video.id}.jpg`;
    const thumbnailDir = path.join(this.publicDir, 'uploads', 'thumbnails');
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    await this.addLog(job.id, 'Generating thumbnail snapshot...');
    await new Promise<void>((resolve, reject) => {
      ffmpeg(absoluteVideoPath)
        .screenshots({
          timestamps: [1], // screenshot at 1 second
          filename: thumbnailName,
          folder: thumbnailDir,
          size: '640x360',
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    const thumbnailUrl = `/uploads/thumbnails/${thumbnailName}`;
    await this.addLog(job.id, `Thumbnail snapshot generated successfully at: ${thumbnailUrl}`);

    // Update Video in DB
    await this.prisma.video.update({
      where: { id: video.id },
      data: {
        duration: durationStr,
        resolution: resolutionStr,
        quality: qualityStr,
        fps,
        thumbnailUrl,
      },
    });

    // Update Project status to PROCESSING and processingState to TRANSCRIBING
    await this.prisma.project.update({
      where: { id: job.projectId },
      data: {
        status: 'PROCESSING',
        processingState: 'TRANSCRIBING',
        videoDuration: durationStr,
        videoSize: sizeStr,
        videoQuality: qualityStr,
        thumbnailUrl,
        localVideoPath: video.localPath,
        videoTitle: video.title,
      },
    });

    // Create Transcription background job
    await this.prisma.backgroundJob.create({
      data: {
        projectId: job.projectId,
        videoId: video.id,
        type: 'TRANSCRIPTION',
        status: 'QUEUED',
        logs: JSON.stringify([
          `[${new Date().toISOString()}] Enqueued transcription pipeline for file: ${video.title}`
        ]),
      },
    });

    // Write Usage log tracking (duration & storage)
    await this.prisma.usageLog.create({
      data: {
        userId: project.userId, // Fixed IDOR/wrong key bug
        projectId: job.projectId,
        action: 'VIDEO_IMPORT_TRACKING',
        amount: Math.ceil(durationSec / 60), // Track duration in minutes
      },
    });
  }

  /**
   * Handle simulated AI video clipping and speech re-indexing
   */
  private async handleAiProcessingSimulation(job: any) {
    const project = await this.prisma.project.findUnique({
      where: { id: job.projectId },
      include: { videos: true },
    });
    if (!project) throw new Error('Project not found');

    await this.addLog(job.id, 'Starting AI clip extraction flow...');
    
    // Simulate steps with sleep
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    await sleep(2000);
    await this.addLog(job.id, 'Step 1/4 Completed: Speech transcript indexed via Whisper');

    await sleep(2500);
    await this.addLog(job.id, 'Step 2/4 Completed: Face Speaker diarization models trained');

    await sleep(2500);
    await this.addLog(job.id, 'Step 3/4 Completed: Viral scoring & clip frames matching completed');

    await sleep(2000);
    // Generate clips in database
    const videoUrl = project.youtubeUrl;
    const mode = project.mode as 'AUTO' | 'MANUAL';
    const maxDurationSec = parseInt(project.maxDuration, 10) || 60;
    
    // Fetch manual clips if they are configured
    const manualClips: { startTime: string; endTime: string }[] = []; 
    // In simulation we can pass standard manual ranges if manual mode is active
    
    const clips = await this.aiDirector.analyzeVideo(videoUrl, mode, maxDurationSec, manualClips, project.name);
    
    // Clear existing clips
    await this.prisma.clip.deleteMany({ where: { projectId: project.id } });

    for (const clip of clips) {
      await this.prisma.clip.create({
        data: {
          projectId: project.id,
          title: clip.title,
          description: clip.description,
          hashtags: clip.hashtags,
          startTime: clip.startTime,
          endTime: clip.endTime,
          viralScore: clip.viralScore,
          engagementScore: clip.engagementScore,
          hookScore: clip.hookScore,
          retentionScore: clip.retentionScore,
          confidenceScore: clip.confidenceScore,
          duration: clip.duration,
          explanation: clip.explanation,
          words: clip.words,
          category: clip.category || 'GENERAL',
          isFavorite: false,
          infoDensityScore: clip.infoDensityScore || 0,
          emotionalScore: clip.emotionalScore || 0,
          storyScore: clip.storyScore || 0,
          clarityScore: clip.clarityScore || 0,
          relevanceScore: clip.relevanceScore || 0,
          reframeAspect: clip.reframeAspect,
          layoutMode: clip.layoutMode,
          reframeSettings: clip.reframeSettings,
          trackingData: clip.trackingData,
          cameraDecisions: clip.cameraDecisions,
        },
      });
    }

    await this.addLog(job.id, `Step 4/4 Completed: Generated ${clips.length} viral shorts segments.`);

    const bestScore = clips.length > 0 ? Math.max(...clips.map(c => c.viralScore)) : 0;
    const uniqueCategories = Array.from(new Set(clips.map(c => c.category || 'GENERAL')));

    let durationMins = 8.5; // fallback
    if (project.videoDuration) {
      const parts = project.videoDuration.split(':').map(Number);
      if (parts.length === 2) {
        durationMins = parts[0] + parts[1] / 60;
      }
    }

    // Update project state
    await this.prisma.project.update({
      where: { id: project.id },
      data: { 
        status: 'COMPLETED', 
        processingState: 'COMPLETED',
        aiProcessingStatus: 'COMPLETED',
        bestClipScore: bestScore,
        categoriesFound: JSON.stringify(uniqueCategories),
        aiAnalysisMinutes: parseFloat(durationMins.toFixed(2)),
        clipGenerationCount: clips.length,
      },
    });

    // Write Usage logs for face tracking and reframing
    await this.prisma.usageLog.create({
      data: {
        userId: project.userId,
        projectId: project.id,
        action: 'FACE_TRACKING_MINUTES_TRACKING',
        amount: Math.ceil(durationMins),
      },
    });

    await this.prisma.usageLog.create({
      data: {
        userId: project.userId,
        projectId: project.id,
        action: 'REFRAMING_MINUTES_TRACKING',
        amount: Math.ceil(durationMins),
      },
    });
  }

  /**
   * Run transcription pipeline job
   */
  private async handleTranscriptionJob(job: any) {
    const startTime = Date.now();
    await this.addLog(job.id, 'Starting Speech-to-Text Whisper transcription pipeline...');

    const video = await this.prisma.video.findUnique({ where: { id: job.videoId } });
    if (!video) throw new Error(`Video with ID ${job.videoId} not found`);

    // Simulate analysis delay
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    await sleep(2500);

    await this.addLog(job.id, 'Detecting source language and loading language models...');
    await sleep(1500);

    // Call actual transcription service to transcribe and write to DB
    const result = await this.transcriptionService.transcribeProject(job.projectId, video.id);
    await this.addLog(job.id, `Detected language: ${result.detectedLanguage} (Confidence: ${(result.confidence * 100).toFixed(1)}%)`);
    await this.addLog(job.id, `Calculated speaking speed: ${result.averageSpeedWpm} WPM`);
    await this.addLog(job.id, `Successfully saved paragraphs, sentences, and ${result.words.length} words to DB.`);

    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;

    // Enqueue AI clip discovery engine simulation job
    await this.prisma.backgroundJob.create({
      data: {
        projectId: job.projectId,
        videoId: video.id,
        type: 'AI_PROCESSING_SIMULATION',
        status: 'QUEUED',
        logs: JSON.stringify([
          `[${new Date().toISOString()}] Enqueued AI clips extraction simulation pipeline.`
        ]),
      },
    });

    // Update project state to show we are analyzing and slicing clips now
    await this.prisma.project.update({
      where: { id: job.projectId },
      data: {
        status: 'PROCESSING',
        processingState: 'AI_PROCESSING',
        transcriptionDuration: parseFloat(durationSec.toFixed(2)),
      },
    });

    // Write Usage log tracking transcription
    const project = await this.prisma.project.findUnique({
      where: { id: job.projectId },
    });
    if (project) {
      await this.prisma.usageLog.create({
        data: {
          userId: project.userId,
          projectId: project.id,
          action: 'TRANSCRIPTION',
          amount: Math.ceil(project.transcribedMinutes),
        },
      });
    }
  }

  private hexToAssColor(hex: string): string {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    if (clean.length !== 6) return '&H00FFFFFF';
    const r = clean.substring(0, 2);
    const g = clean.substring(2, 4);
    const b = clean.substring(4, 6);
    return `&H00${b}${g}${r}`;
  }

  private escapeFfmpegSubtitlesPath(absolutePath: string): string {
    let formatted = absolutePath.replace(/\\/g, '/');
    formatted = formatted.replace(/^([a-zA-Z]):/, '$1\\\\:');
    return formatted;
  }

  /**
   * Run precise video cutting and slicing using FFmpeg
   */
  private async handleClipExportJob(job: any) {
    let logsArray: string[] = [];
    try {
      logsArray = job.logs ? JSON.parse(job.logs) : [];
    } catch (e) {
      logsArray = [];
    }

    const qualityConfig = logsArray.find(l => l.startsWith('CONFIG_QUALITY:'));
    const clipIdConfig = logsArray.find(l => l.startsWith('CONFIG_CLIP_ID:'));

    const quality = qualityConfig ? (qualityConfig.split(':')[1] as '720p' | '1080p') : '1080p';
    const clipId = clipIdConfig ? clipIdConfig.split(':')[1] : '';

    if (!clipId) throw new Error('Clip ID not found in export job logs configuration');

    const clip = await this.prisma.clip.findUnique({
      where: { id: clipId },
      include: { project: true },
    });
    if (!clip) throw new Error(`Clip with ID ${clipId} not found`);

    const project = clip.project;
    const localVideoPath = project.localVideoPath || '/videos/sample.mp4';
    const absoluteInputPath = path.join(this.publicDir, localVideoPath);

    if (!fs.existsSync(absoluteInputPath)) {
      throw new Error(`Source video file not found at: ${absoluteInputPath}`);
    }

    const exportsDir = path.join(this.publicDir, 'uploads', 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const outputFileName = `${clip.id}-${quality}.mp4`;
    const absoluteOutputPath = path.join(exportsDir, outputFileName);
    const relativeOutputPath = `/uploads/exports/${outputFileName}`;

    const timeToSec = (str: string) => {
      const parts = str.split(':').map(Number);
      return parts.length === 2 ? parts[0] * 60 + parts[1] : Number(str) || 0;
    };

    const startSec = timeToSec(clip.startTime);
    const endSec = timeToSec(clip.endTime);
    const durationSec = endSec - startSec;

    await this.addLog(job.id, `Starting FFmpeg cutting process. Target quality: ${quality}`);
    await this.addLog(job.id, `Slicing video range: ${clip.startTime} -> ${clip.endTime} (${durationSec} seconds)`);

    // Parse brand/captions/export configurations
    let burnIn = true;
    if (clip.exportSettings) {
      try {
        const expSettings = JSON.parse(clip.exportSettings);
        if (expSettings.burnIn !== undefined) {
          burnIn = expSettings.burnIn;
        }
      } catch (e) {}
    }

    let primaryColor = '#ffffff';
    let secondaryColor = '#8b5cf6';
    let fontFamily = 'Arial';
    let fontSize = 20;

    if (clip.brandKitId) {
      const brandKit = await this.prisma.brandKit.findUnique({ where: { id: clip.brandKitId } });
      if (brandKit) {
        primaryColor = brandKit.primaryColor;
        secondaryColor = brandKit.secondaryColor;
        fontFamily = brandKit.fontFamily;
      }
    }

    if (clip.captionSettings) {
      try {
        const settings = JSON.parse(clip.captionSettings);
        if (settings.primaryColor) primaryColor = settings.primaryColor;
        if (settings.secondaryColor) secondaryColor = settings.secondaryColor;
        if (settings.fontFamily) fontFamily = settings.fontFamily;
        if (settings.fontSize) fontSize = settings.fontSize;
      } catch (e) {}
    }

    // Build subtitle content from clip.words JSON
    const wordsList = JSON.parse(clip.words || '[]');
    let subtitleContent = '';
    
    if (wordsList.length > 0) {
      const entries: { start: number; end: number; text: string }[] = [];
      let currentGroup: any[] = [];

      for (const w of wordsList) {
        if (currentGroup.length >= 4 || (currentGroup.length > 0 && w.start - currentGroup[currentGroup.length - 1].end > 1.5)) {
          const start = currentGroup[0].start;
          const end = currentGroup[currentGroup.length - 1].end;
          const text = currentGroup.map(item => item.word + (item.emoji ? ` ${item.emoji}` : '')).join(' ');
          entries.push({ start, end, text });
          currentGroup = [];
        }
        currentGroup.push(w);
      }
      if (currentGroup.length > 0) {
        const start = currentGroup[0].start;
        const end = currentGroup[currentGroup.length - 1].end;
        const text = currentGroup.map(item => item.word + (item.emoji ? ` ${item.emoji}` : '')).join(' ');
        entries.push({ start, end, text });
      }

      const formatSrtTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
      };

      entries.forEach((entry, idx) => {
        subtitleContent += `${idx + 1}\n`;
        subtitleContent += `${formatSrtTime(entry.start)} --> ${formatSrtTime(entry.end)}\n`;
        subtitleContent += `${entry.text}\n\n`;
      });
    }

    let manualCropX = 50;
    let manualCropY = 35;
    if (clip.reframeSettings) {
      try {
        const settings = JSON.parse(clip.reframeSettings);
        if (settings.manualCropX !== undefined) manualCropX = settings.manualCropX;
        if (settings.manualCropY !== undefined) manualCropY = settings.manualCropY;
      } catch (e) {}
    }

    let aspect = clip.reframeAspect || '9:16';
    let layout = clip.layoutMode || 'AUTO';

    let scaleW = 1080;
    let scaleH = 1920;

    if (aspect === '9:16') {
      scaleW = quality === '720p' ? 720 : 1080;
      scaleH = quality === '720p' ? 1280 : 1920;
    } else if (aspect === '1:1') {
      scaleW = quality === '720p' ? 720 : 1080;
      scaleH = quality === '720p' ? 720 : 1080;
    } else if (aspect === '4:5') {
      scaleW = quality === '720p' ? 720 : 1080;
      scaleH = quality === '720p' ? 900 : 1350;
    } else { // 16:9
      scaleW = quality === '720p' ? 1280 : 1920;
      scaleH = quality === '720p' ? 720 : 1080;
    }

    let filterString = '';

    if (layout === 'SPLIT' || layout === 'DUAL_SPEAKER') {
      if (aspect === '9:16') {
        filterString = `split=2[v1][v2];[v1]crop=in_h*9/16:in_h*0.5:in_w*0.35-(in_h*9/32):in_h*0.25[c1];[v2]crop=in_h*9/16:in_h*0.5:in_w*0.65-(in_h*9/32):in_h*0.25[c2];[c1][c2]vstack,scale=${scaleW}:${scaleH}`;
      } else if (aspect === '1:1') {
        filterString = `split=2[v1][v2];[v1]crop=in_h:in_h*0.5:in_w*0.35-(in_h*0.5):in_h*0.25[c1];[v2]crop=in_h:in_h*0.5:in_w*0.65-(in_h*0.5):in_h*0.25[c2];[c1][c2]vstack,scale=${scaleW}:${scaleH}`;
      } else if (aspect === '4:5') {
        filterString = `split=2[v1][v2];[v1]crop=in_h*4/5:in_h*0.5:in_w*0.35-(in_h*0.4):in_h*0.25[c1];[v2]crop=in_h*4/5:in_h*0.5:in_w*0.65-(in_h*0.4):in_h*0.25[c2];[c1][c2]vstack,scale=${scaleW}:${scaleH}`;
      } else { // 16:9
        filterString = `split=2[v1][v2];[v1]crop=in_w*0.5:in_h:0:0[c1];[v2]crop=in_w*0.5:in_h:in_w*0.5:0[c2];[c1][c2]hstack,scale=${scaleW}:${scaleH}`;
      }
    } else {
      if (aspect === '9:16') {
        filterString = `crop=in_h*9/16:in_h:(in_w*${manualCropX/100})-(in_h*9/32):0,scale=${scaleW}:${scaleH}`;
      } else if (aspect === '1:1') {
        filterString = `crop=in_h:in_h:(in_w*${manualCropX/100})-(in_h*0.5):0,scale=${scaleW}:${scaleH}`;
      } else if (aspect === '4:5') {
        filterString = `crop=in_h*4/5:in_h:(in_w*${manualCropX/100})-(in_h*0.4):0,scale=${scaleW}:${scaleH}`;
      } else {
        filterString = `scale=${scaleW}:${scaleH}`;
      }
    }

    let tempSubPath = '';

    if (burnIn && subtitleContent) {
      const tempSubDir = path.join(this.publicDir, 'uploads', 'exports');
      if (!fs.existsSync(tempSubDir)) {
        fs.mkdirSync(tempSubDir, { recursive: true });
      }
      tempSubPath = path.join(tempSubDir, `temp-${clip.id}.srt`);
      fs.writeFileSync(tempSubPath, subtitleContent, 'utf8');

      const escapedSubPath = this.escapeFfmpegSubtitlesPath(tempSubPath);
      const assPrimary = this.hexToAssColor(primaryColor);
      const assFont = fontFamily || 'Arial';
      const forceStyle = `Fontname=${assFont},Fontsize=${fontSize},PrimaryColour=${assPrimary},OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,Alignment=2`;
      filterString += `,subtitles='${escapedSubPath}':force_style='${forceStyle}'`;
      await this.addLog(job.id, `Created transient subtitles file to burn in at: ${tempSubPath}`);
    }

    // Run ffmpeg process
    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg(absoluteInputPath)
        .setStartTime(startSec)
        .setDuration(durationSec)
        .output(absoluteOutputPath);

      cmd = cmd.videoFilters(filterString);

      cmd
        .on('start', (cmdline) => {
          this.logger.log(`Running FFmpeg command: ${cmdline}`);
        })
        .on('end', () => {
          if (tempSubPath && fs.existsSync(tempSubPath)) {
            try {
              fs.unlinkSync(tempSubPath);
            } catch (e) {
              this.logger.warn(`Failed to clean up transient subtitle file: ${e.message}`);
            }
          }
          resolve();
        })
        .on('error', (err) => {
          if (tempSubPath && fs.existsSync(tempSubPath)) {
            try {
              fs.unlinkSync(tempSubPath);
            } catch (e) {
              this.logger.warn(`Failed to clean up transient subtitle file: ${e.message}`);
            }
          }
          reject(err);
        })
        .run();
    });

    await this.addLog(job.id, `Slicing complete. Sliced file saved to: ${relativeOutputPath}`);

    // Update clip database record with path
    if (quality === '720p') {
      await this.prisma.clip.update({
        where: { id: clipId },
        data: { videoPath720p: relativeOutputPath },
      });
    } else {
      await this.prisma.clip.update({
        where: { id: clipId },
        data: { videoPath1080p: relativeOutputPath },
      });
    }

    // Increment export count on project and log billing usage
    await this.prisma.project.update({
      where: { id: project.id },
      data: { exportCount: { increment: 1 } },
    });

    await this.prisma.usageLog.create({
      data: {
        userId: project.userId,
        projectId: project.id,
        action: 'CLIP_EXPORT',
        amount: 1, // 1 clip export
      },
    });

    // Capture CAPTION_RENDERING_TRACKING and STYLED_EXPORT_TRACKING metrics (free of credit charge)
    await this.prisma.usageLog.create({
      data: {
        userId: project.userId,
        projectId: project.id,
        action: 'CAPTION_RENDERING_TRACKING',
        amount: 1,
      },
    });

    await this.prisma.usageLog.create({
      data: {
        userId: project.userId,
        projectId: project.id,
        action: 'STYLED_EXPORT_TRACKING',
        amount: 1,
      },
    });

    await this.prisma.usageLog.create({
      data: {
        userId: project.userId,
        projectId: project.id,
        action: 'EXPORT_COMPLEXITY_TRACKING',
        amount: clip.reframeAspect && clip.reframeAspect !== '16:9' ? 2 : 1,
      },
    });
  }
}
