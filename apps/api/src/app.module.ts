import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { VideoProcessingModule } from './video-processing/video-processing.module';
import { AiDirectorModule } from './ai-director/ai-director.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProjectsModule,
    VideoProcessingModule,
    AiDirectorModule,
    AdminModule,
  ],
})
export class AppModule {}
