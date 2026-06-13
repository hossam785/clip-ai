import { Module } from '@nestjs/common';
import { AiDirectorService } from './ai-director.service';

@Module({
  providers: [AiDirectorService],
  exports: [AiDirectorService],
})
export class AiDirectorModule {}
