import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { VideoProcessingModule } from './video-processing/video-processing.module';
import { AiDirectorModule } from './ai-director/ai-director.module';
import { AdminModule } from './admin/admin.module';
import { BillingModule } from './billing/billing.module';
import { BrandKitsModule } from './brand-kits/brand-kits.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DeveloperModule } from './developer/developer.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProjectsModule,
    VideoProcessingModule,
    AiDirectorModule,
    AdminModule,
    BillingModule,
    BrandKitsModule,
    IntegrationsModule,
    AnalyticsModule,
    DeveloperModule,
  ],
})
export class AppModule {}
