import { Module } from '@nestjs/common';
import { VideoProcessingService } from './video-processing.service';
import { QueueService } from './queue.service';
import { TranscriptionService } from './transcription.service';
import { AiDirectorModule } from '../ai-director/ai-director.module';

@Module({
  imports: [AiDirectorModule],
  providers: [VideoProcessingService, QueueService, TranscriptionService],
  exports: [VideoProcessingService, QueueService, TranscriptionService],
})
export class VideoProcessingModule {}
