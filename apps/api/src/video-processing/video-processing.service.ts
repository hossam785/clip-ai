import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiDirectorService } from '../ai-director/ai-director.service';

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);

  constructor(
    private prisma: PrismaService,
    private aiDirector: AiDirectorService,
  ) {}

  /**
   * Queue video processing and start background simulation.
   * Since there is no Redis container running, we perform
   * simulated asynchronous processing step by step.
   */
  async queueVideoProcessing(
    projectId: string,
    videoUrl: string | null,
    mode: 'AUTO' | 'MANUAL',
    maxDurationSec: number,
    manualClips?: { startTime: string; endTime: string }[]
  ) {
    this.logger.log(`Queueing processing for project ${projectId} (Mode: ${mode})`);

    // Set status to PROCESSING
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'PROCESSING' },
    });

    // Simulate background worker
    this.processInBg(projectId, videoUrl, mode, maxDurationSec, manualClips).catch(err => {
      this.logger.error(`Error in background processing: ${err.message}`);
    });

    return { jobId: 'simulated-job-' + projectId };
  }

  private async processInBg(
    projectId: string,
    videoUrl: string | null,
    mode: 'AUTO' | 'MANUAL',
    maxDurationSec: number,
    manualClips?: { startTime: string; endTime: string }[]
  ) {
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
      this.logger.log(`[Worker] Started processing project ${projectId}`);
      
      // Step 1: Downloading & Fetching Metas
      await sleep(1500);
      this.logger.log(`[Worker] Step 1/5 Completed: Video fetched`);

      // Step 2: Audio extraction
      await sleep(1500);
      this.logger.log(`[Worker] Step 2/5 Completed: Audio extracted`);

      // Step 3: Speech to Text (Whisper transcription)
      await sleep(2000);
      this.logger.log(`[Worker] Step 3/5 Completed: Speech transcribed`);

      // Step 4: Facial tracking & Scene diarization
      await sleep(1500);
      this.logger.log(`[Worker] Step 4/5 Completed: Face speaker matching indexed`);

      // Step 5: AI clips analysis & selection
      await sleep(1500);
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
      });
      const videoTitle = project?.videoTitle || project?.name || '';
      
      const clips = await this.aiDirector.analyzeVideo(videoUrl, mode, maxDurationSec, manualClips, videoTitle);
      
      // Create clips in DB
      for (const clip of clips) {
        await this.prisma.clip.create({
          data: {
            projectId,
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
            reframeAspect: clip.reframeAspect,
            layoutMode: clip.layoutMode,
            reframeSettings: clip.reframeSettings,
            trackingData: clip.trackingData,
            cameraDecisions: clip.cameraDecisions,
          },
        });
      }

      // Mark COMPLETED
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'COMPLETED' },
      });

      this.logger.log(`[Worker] Step 5/5 Completed: Project ${projectId} marked COMPLETED!`);
    } catch (err) {
      this.logger.error(`[Worker] Project ${projectId} processing failed: ${err.message}`);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'FAILED' },
      });
    }
  }
}
