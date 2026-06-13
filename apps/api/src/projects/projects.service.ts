import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VideoProcessingService } from '../video-processing/video-processing.service';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private videoProcessor: VideoProcessingService,
  ) {}

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

    // Check pricing
    const pricing = await this.getPricing();
    let totalCost = 0;

    if (mode === 'AUTO') {
      // Auto mode costs e.g. 30 credits (standard 3 clips)
      totalCost += pricing.pricePerClip * 3;
    } else {
      // Manual mode costs: per custom clip + effects if checked
      totalCost += manualClips.length * pricing.priceCustomRange;
    }

    if (effects) {
      totalCost += pricing.priceEffects;
    }

    // Get user wallet details
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.credits < totalCost) {
      throw new BadRequestException(`Insufficient credits! This action requires ${totalCost} credits, but you only have ${user.credits} credits.`);
    }

    // Deduct credits
    await this.prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: totalCost } },
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
        status: 'DRAFT',
        videoTitle: name,
        videoDuration: '08:45',
        videoSize: '145.2 MB',
        videoQuality: '1080p Full HD',
        thumbnailUrl: '/static/thumbnails/joerogan_eminem.jpg',
        localVideoPath: '/videos/sample.mp4',
      },
    });

    // Queue processing
    const maxDurationSec = parseInt(maxDuration, 10) || 60;
    await this.videoProcessor.queueVideoProcessing(project.id, youtubeUrl || null, mode, maxDurationSec, manualClips);

    return { project, cost: totalCost };
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
    const isYoutube = youtubeUrl.includes('youtube.com') || youtubeUrl.includes('youtu.be');
    const defaultName = name || (isYoutube 
      ? 'YouTube Imported Video' 
      : 'Imported Local Video');
    
    // Create the project in DOWNLOADING status
    const project = await this.prisma.project.create({
      data: {
        userId,
        name: defaultName,
        youtubeUrl,
        status: 'DOWNLOADING',
      },
    });

    // Simulate background downloading to platform storage
    // It updates status to DOWNLOADED and populates metadata
    setTimeout(async () => {
      try {
        let videoTitle = defaultName;
        let thumbnailUrl = '/static/thumbnails/joerogan_eminem.jpg';

        if (isYoutube) {
          const meta = await this.getYoutubeMetadata(youtubeUrl);
          videoTitle = name || meta.title;
          thumbnailUrl = meta.thumbnailUrl;
        }

        await this.prisma.project.update({
          where: { id: project.id },
          data: {
            status: 'DOWNLOADED',
            name: videoTitle,
            videoTitle,
            videoDuration: '08:45',
            videoSize: '145.2 MB',
            videoQuality: '1080p Full HD',
            thumbnailUrl,
            localVideoPath: '/videos/sample.mp4',
          },
        });
        console.log(`[Worker] YouTube video imported and downloaded locally for project: ${project.id}`);
      } catch (err) {
        console.error('Error updating project status in download simulation:', err);
      }
    }, 2500);

    return project;
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

    // Get user wallet details
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.credits < totalCost) {
      throw new BadRequestException(`Insufficient credits! This action requires ${totalCost} credits, but you only have ${user.credits} credits.`);
    }

    // Deduct credits
    await this.prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: totalCost } },
    });

    // Update project configuration and change status to PROCESSING
    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        mode,
        maxDuration,
        effects,
        status: 'PROCESSING',
      },
    });

    // Queue speech-reframing worker processing
    const maxDurationSec = parseInt(maxDuration, 10) || 60;
    await this.videoProcessor.queueVideoProcessing(projectId, project.youtubeUrl, mode, maxDurationSec, manualClips);

    return { project: updatedProject, cost: totalCost };
  }

  async findAll(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { clips: true },
        },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, userId },
      include: { clips: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async remove(id: string, userId: string) {
    const project = await this.findOne(id, userId);
    return this.prisma.project.delete({ where: { id: project.id } });
  }

  async findClips(projectId: string) {
    return this.prisma.clip.findMany({
      where: { projectId },
      orderBy: { startTime: 'asc' },
    });
  }

  async updateClip(clipId: string, data: { title?: string; startTime?: string; endTime?: string }) {
    const clip = await this.prisma.clip.findUnique({ where: { id: clipId } });
    if (!clip) throw new NotFoundException('Clip not found');

    return this.prisma.clip.update({
      where: { id: clipId },
      data,
    });
  }

  async deleteClip(clipId: string) {
    return this.prisma.clip.delete({ where: { id: clipId } });
  }

  async regenerateClip(clipId: string) {
    const clip = await this.prisma.clip.findUnique({ where: { id: clipId } });
    if (!clip) throw new NotFoundException('Clip not found');

    // Simulate regenerating (randomizes scores slightly and changes title slightly)
    const newScore = Math.floor(Math.random() * 10) + 90;
    return this.prisma.clip.update({
      where: { id: clipId },
      data: {
        title: clip.title + ' (Optimized Version)',
        viralScore: newScore,
      },
    });
  }
}
