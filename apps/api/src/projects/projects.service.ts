import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VideoProcessingService } from '../video-processing/video-processing.service';
import { BillingService } from '../billing/billing.service';
import { UploadService } from './upload.service';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

function signPath(relativePath: string | null | undefined, expiryMs: number = 3600 * 1000): string | null | undefined {
  if (!relativePath) return relativePath;
  if (!relativePath.startsWith('/uploads/')) return relativePath;

  const expires = Date.now() + expiryMs;
  const secret = process.env.JWT_SECRET || 'clip-ai-secret-key-super-secure-2026';
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${cleanPath}:${expires}`)
    .digest('hex');

  const connector = relativePath.includes('?') ? '&' : '?';
  return `${relativePath}${connector}expires=${expires}&signature=${signature}`;
}

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private videoProcessor: VideoProcessingService,
    private billing: BillingService,
    private uploadService: UploadService,
  ) {}

  private signProject(project: any) {
    if (!project) return project;
    if (project.localVideoPath) {
      project.localVideoPath = signPath(project.localVideoPath);
    }
    if (project.thumbnailUrl) {
      project.thumbnailUrl = signPath(project.thumbnailUrl);
    }
    if (project.videos) {
      project.videos = project.videos.map(v => this.signVideo(v));
    }
    if (project.clips) {
      project.clips = project.clips.map(c => this.signClip(c));
    }
    return project;
  }

  private signVideo(video: any) {
    if (!video) return video;
    if (video.localPath) {
      video.localPath = signPath(video.localPath);
    }
    if (video.thumbnailUrl) {
      video.thumbnailUrl = signPath(video.thumbnailUrl);
    }
    return video;
  }

  private signClip(clip: any) {
    if (!clip) return clip;
    if (clip.videoPath720p) {
      clip.videoPath720p = signPath(clip.videoPath720p);
    }
    if (clip.videoPath1080p) {
      clip.videoPath1080p = signPath(clip.videoPath1080p);
    }
    return clip;
  }

  async getPricing(): Promise<{ pricePerClip: number; priceCustomRange: number; priceEffects: number }> {
    const configs = await this.prisma.systemConfig.findMany();
    const valMap = new Map<string, number>();
    for (const c of configs) {
      valMap.set(c.key, parseInt(c.value, 10));
    }

    return {
      pricePerClip: valMap.get('price_per_clip') ?? 10,
      priceCustomRange: valMap.get('price_custom_range') ?? 15,
      priceEffects: valMap.get('price_effects') ?? 10,
    };
  }

  async create(data: {
    userId: string;
    name: string;
    youtubeUrl?: string;
    mode: 'AUTO' | 'MANUAL';
    maxDuration: string;
    manualClips?: { startTime: string; endTime: string }[];
    effects: boolean;
  }) {
    const { userId, name, youtubeUrl, mode, maxDuration, manualClips = [], effects } = data;

    // Verify monthly upload limits
    await this.billing.checkUploadLimit(userId);

    // Check pricing
    const pricing = await this.getPricing();
    let totalCost = 0;

    if (mode === 'AUTO') {
      totalCost += pricing.pricePerClip * 3;
    } else {
      totalCost += manualClips.length * pricing.priceCustomRange;
    }

    if (effects) {
      totalCost += pricing.priceEffects;
    }

    // Deduct credits & log transaction
    await this.billing.useCredits(userId, totalCost, 'CLIP_GENERATION', `Clip generation for project: ${name}`);

    // Log Usage
    await this.prisma.usageLog.create({
      data: {
        userId,
        action: 'CLIP_GENERATION',
        amount: totalCost,
      },
    });

    // Create project
    const project = await this.prisma.project.create({
      data: {
        userId,
        name,
        youtubeUrl,
        mode,
        maxDuration,
        effects,
        status: 'PROCESSING',
        processingState: 'QUEUED',
        videoTitle: name,
        videoDuration: '08:45',
        videoSize: '145.2 MB',
        videoQuality: '1080p Full HD',
        thumbnailUrl: '/static/thumbnails/joerogan_eminem.jpg',
        localVideoPath: '/videos/sample.mp4',
      },
    });

    // Create BackgroundJob for AI Simulation
    await this.prisma.backgroundJob.create({
      data: {
        projectId: project.id,
        type: 'AI_PROCESSING_SIMULATION',
        status: 'QUEUED',
        logs: JSON.stringify([
          `[${new Date().toISOString()}] Enqueued AI clips extraction simulation for project: ${name}`
        ]),
      },
    });

    return { project: this.signProject(project), cost: totalCost };
  }

  async getYoutubeMetadata(url: string): Promise<{ title: string; thumbnailUrl: string }> {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (response.ok) {
        const data = await response.json() as any;
        return {
          title: data.title || 'YouTube Imported Video',
          thumbnailUrl: data.thumbnail_url || '/static/thumbnails/joerogan_eminem.jpg',
        };
      }
    } catch (e) {
      console.error('Failed to fetch YouTube oEmbed metadata:', e);
    }
    return {
      title: 'YouTube Imported Video',
      thumbnailUrl: '/static/thumbnails/joerogan_eminem.jpg',
    };
  }

  async importVideo(youtubeUrl: string, name: string | undefined, userId: string) {
    // Verify monthly upload limits
    await this.billing.checkUploadLimit(userId);

    const isYoutube = youtubeUrl.includes('youtube.com') || youtubeUrl.includes('youtu.be');
    const defaultName = name || (isYoutube 
      ? 'YouTube Imported Video' 
      : 'Imported Local Video');
    
    // Create the project in PROCESSING status
    const project = await this.prisma.project.create({
      data: {
        userId,
        name: defaultName,
        youtubeUrl,
        status: 'PROCESSING',
        processingState: 'QUEUED',
      },
    });

    // Create Video record (representing the YouTube target, we'll link to sample video for local simulation)
    const video = await this.prisma.video.create({
      data: {
        projectId: project.id,
        title: defaultName,
        duration: '00:00',
        size: '0 MB',
        quality: '1080p',
        url: youtubeUrl,
        localPath: '/videos/sample.mp4', // Point to sample.mp4 so ffmpeg has a valid local file to scan
        uploadSource: 'YOUTUBE',
      },
    });

    // Create BackgroundJob
    await this.prisma.backgroundJob.create({
      data: {
        projectId: project.id,
        videoId: video.id,
        type: 'METADATA_EXTRACTION',
        status: 'QUEUED',
        logs: JSON.stringify([
          `[${new Date().toISOString()}] Enqueued YouTube stream download simulation for URL: ${youtubeUrl}`
        ]),
      },
    });

    return this.signProject(project);
  }

  async handleChunkUpload(data: {
    projectId: string;
    chunkIndex: number;
    totalChunks: number;
    fileName: string;
    buffer: Buffer;
    userId: string;
  }) {
    const { projectId, chunkIndex, totalChunks, fileName, buffer, userId } = data;

    // Verify project ownership before writing chunks
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException('Project not found');

    // Call UploadService to handle chunk saving
    const result = await this.uploadService.saveChunk(
      projectId,
      chunkIndex,
      totalChunks,
      buffer,
      fileName,
    );

    if (result.completed && result.filePath && result.relativePath) {
      // Check storage limits
      const stats = await fs.promises.stat(result.filePath);
      await this.billing.checkStorageLimit(userId, stats.size);

      // Create Video record
      const video = await this.prisma.video.create({
        data: {
          projectId,
          title: fileName,
          duration: '00:00', // updated by worker
          size: '0 MB', // updated by worker
          quality: 'Checking...', // updated by worker
          localPath: result.relativePath,
          uploadSource: 'UPLOAD',
        },
      });

      // Update Project processingState & status
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'PROCESSING',
          processingState: 'QUEUED',
          localVideoPath: result.relativePath,
          videoTitle: fileName,
        },
      });

      // Create BackgroundJob for metadata extraction
      const job = await this.prisma.backgroundJob.create({
        data: {
          projectId,
          videoId: video.id,
          type: 'METADATA_EXTRACTION',
          status: 'QUEUED',
          logs: JSON.stringify([
            `[${new Date().toISOString()}] Enqueued metadata extraction for uploaded file: ${fileName}`
          ]),
        },
      });

      return { completed: true, video: this.signVideo(video), jobId: job.id };
    }

    return { completed: false };
  }

  async archiveProject(id: string, userId: string) {
    const project = await this.prisma.project.findFirst({ where: { id, userId } });
    if (!project) throw new NotFoundException('Project not found');

    const updated = await this.prisma.project.update({
      where: { id },
      data: { isArchived: true },
    });
    return this.signProject(updated);
  }

  async unarchiveProject(id: string, userId: string) {
    const project = await this.prisma.project.findFirst({ where: { id, userId } });
    if (!project) throw new NotFoundException('Project not found');

    const updated = await this.prisma.project.update({
      where: { id },
      data: { isArchived: false },
    });
    return this.signProject(updated);
  }

  async renameProject(id: string, name: string, userId: string) {
    const project = await this.prisma.project.findFirst({ where: { id, userId } });
    if (!project) throw new NotFoundException('Project not found');

    const updated = await this.prisma.project.update({
      where: { id },
      data: { name },
    });
    return this.signProject(updated);
  }

  async getProjectJobs(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.backgroundJob.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProjectTranscript(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.transcript.findUnique({
      where: { projectId },
      include: {
        paragraphs: { orderBy: { startTime: 'asc' } },
        sentences: { orderBy: { startTime: 'asc' } },
        words: { orderBy: { startTime: 'asc' } },
        speakerSegments: { orderBy: { startTime: 'asc' } },
        silenceSegments: { orderBy: { startTime: 'asc' } },
        topicSegments: { orderBy: { startTime: 'asc' } },
      },
    });
  }

  async processProject(
    projectId: string,
    data: {
      mode: 'AUTO' | 'MANUAL';
      maxDuration: string;
      manualClips?: { startTime: string; endTime: string }[];
      effects: boolean;
    },
    userId: string
  ) {
    const { mode, maxDuration, manualClips = [], effects } = data;

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    if (!project) throw new NotFoundException('Project not found');

    // Check pricing
    const pricing = await this.getPricing();
    let totalCost = 0;

    if (mode === 'AUTO') {
      totalCost += pricing.pricePerClip * 3;
    } else {
      totalCost += manualClips.length * pricing.priceCustomRange;
    }

    if (effects) {
      totalCost += pricing.priceEffects;
    }

    // Deduct credits & log transaction
    await this.billing.useCredits(userId, totalCost, 'CLIP_GENERATION', `Re-processing clips for project: ${project.name}`);

    // Log Usage
    await this.prisma.usageLog.create({
      data: {
        userId,
        projectId,
        action: 'CLIP_GENERATION',
        amount: totalCost,
      },
    });

    // Update project configuration and change status to PROCESSING
    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        mode,
        maxDuration,
        effects,
        status: 'PROCESSING',
        processingState: 'QUEUED',
      },
    });

    // Create BackgroundJob for AI Simulation
    await this.prisma.backgroundJob.create({
      data: {
        projectId,
        type: 'AI_PROCESSING_SIMULATION',
        status: 'QUEUED',
        logs: JSON.stringify([
          `[${new Date().toISOString()}] Enqueued AI clips extraction simulation for project: ${project.name}`
        ]),
      },
    });

    return { project: this.signProject(updatedProject), cost: totalCost };
  }

  async findAll(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        videos: true,
        _count: {
          select: { clips: true },
        },
      },
    });
    return projects.map(p => this.signProject(p));
  }

  async findOne(id: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, userId },
      include: { clips: true, videos: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return this.signProject(project);
  }

  async remove(id: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, userId },
      include: { videos: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    // Delete files on disk
    const publicDir = path.join(__dirname, '..', '..', 'public');
    const projectVideoDir = path.join(publicDir, 'uploads', 'videos', id);
    try {
      if (fs.existsSync(projectVideoDir)) {
        fs.rmSync(projectVideoDir, { recursive: true, force: true });
      }
      
      // Also delete video thumbnail if exists
      for (const vid of project.videos || []) {
        if (vid.thumbnailUrl && vid.thumbnailUrl.startsWith('/uploads/thumbnails/')) {
          const thumbPath = path.join(publicDir, vid.thumbnailUrl);
          if (fs.existsSync(thumbPath)) {
            fs.unlinkSync(thumbPath);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to clean files on project removal: ${err.message}`);
    }

    const deleted = await this.prisma.project.delete({ where: { id: project.id } });
    return this.signProject(deleted);
  }

  async findClips(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException('Project not found');

    const clips = await this.prisma.clip.findMany({
      where: { projectId },
      orderBy: { startTime: 'asc' },
    });
    return clips.map(c => this.signClip(c));
  }

  async updateClip(clipId: string, data: {
    title?: string;
    startTime?: string;
    endTime?: string;
    selectedTemplate?: string;
    brandKitId?: string;
    captionSettings?: string;
    exportSettings?: string;
    reframeAspect?: string;
    layoutMode?: string;
    reframeSettings?: string;
    trackingData?: string;
    cameraDecisions?: string;
    words?: string;
  }, userId: string) {
    const clip = await this.prisma.clip.findUnique({
      where: { id: clipId },
      include: { project: true },
    });
    if (!clip) throw new NotFoundException('Clip not found');
    if (clip.project.userId !== userId) throw new BadRequestException('Not authorized');

    const updated = await this.prisma.clip.update({
      where: { id: clipId },
      data,
    });
    return this.signClip(updated);
  }

  async deleteClip(clipId: string, userId: string) {
    const clip = await this.prisma.clip.findUnique({
      where: { id: clipId },
      include: { project: true },
    });
    if (!clip) throw new NotFoundException('Clip not found');
    if (clip.project.userId !== userId) throw new BadRequestException('Not authorized');

    const deleted = await this.prisma.clip.delete({ where: { id: clipId } });
    return this.signClip(deleted);
  }

  async regenerateClip(clipId: string, userId: string) {
    const clip = await this.prisma.clip.findUnique({
      where: { id: clipId },
      include: { project: true },
    });
    if (!clip) throw new NotFoundException('Clip not found');
    if (clip.project.userId !== userId) throw new BadRequestException('Not authorized');

    // Simulate regenerating (randomizes scores slightly and changes title slightly)
    const newScore = Math.floor(Math.random() * 10) + 90;
    const updated = await this.prisma.clip.update({
      where: { id: clipId },
      data: {
        title: clip.title + ' (Optimized Version)',
        viralScore: newScore,
      },
    });
    return this.signClip(updated);
  }

  async exportClip(clipId: string, quality: '720p' | '1080p', userId: string) {
    const clip = await this.prisma.clip.findUnique({
      where: { id: clipId },
      include: { project: true }
    });
    if (!clip) throw new NotFoundException('Clip not found');
    if (clip.project.userId !== userId) throw new BadRequestException('Not authorized');

    // Verify monthly export limits
    await this.billing.checkExportLimit(userId);

    // Create BackgroundJob for CLIP_EXPORT
    const job = await this.prisma.backgroundJob.create({
      data: {
        projectId: clip.projectId,
        type: 'CLIP_EXPORT',
        status: 'QUEUED',
        logs: JSON.stringify([
          `CONFIG_QUALITY:${quality}`,
          `CONFIG_CLIP_ID:${clipId}`,
          `[${new Date().toISOString()}] Enqueued clip export for quality: ${quality}`,
        ]),
      },
    });

    return job;
  }

  async exportCaptions(clipId: string, format: 'srt' | 'vtt', userId: string) {
    const clip = await this.prisma.clip.findUnique({
      where: { id: clipId },
      include: { project: true }
    });
    if (!clip) throw new NotFoundException('Clip not found');
    if (clip.project.userId !== userId) throw new BadRequestException('Not authorized');

    // Record UsageLog entry
    await this.prisma.usageLog.create({
      data: {
        userId: clip.project.userId,
        projectId: clip.projectId,
        action: 'CAPTION_GENERATION_TRACKING',
        amount: 1,
      },
    });

    const wordsList = JSON.parse(clip.words || '[]');
    if (wordsList.length === 0) {
      return format === 'srt' ? '' : 'WEBVTT\n\n';
    }

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

    const formatTime = (seconds: number) => {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);

      const msSeparator = format === 'srt' ? ',' : '.';
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}${msSeparator}${ms.toString().padStart(3, '0')}`;
    };

    let output = '';
    if (format === 'vtt') {
      output += 'WEBVTT\n\n';
    }

    entries.forEach((entry, idx) => {
      output += `${idx + 1}\n`;
      output += `${formatTime(entry.start)} --> ${formatTime(entry.end)}\n`;
      output += `${entry.text}\n\n`;
    });

    return output;
  }

  async favoriteClip(clipId: string, isFavorite: boolean, userId: string) {
    const clip = await this.prisma.clip.findUnique({
      where: { id: clipId },
      include: { project: true },
    });
    if (!clip) throw new NotFoundException('Clip not found');
    if (clip.project.userId !== userId) throw new BadRequestException('Not authorized');

    const updated = await this.prisma.clip.update({
      where: { id: clipId },
      data: { isFavorite },
    });
    return this.signClip(updated);
  }
}

