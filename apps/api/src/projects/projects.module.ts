import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { UploadService } from './upload.service';
import { ProjectsController } from './projects.controller';
import { AssetsController } from './assets.controller';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { VideoProcessingModule } from '../video-processing/video-processing.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [VideoProcessingModule, BillingModule],
  controllers: [ProjectsController, AssetsController, WorkspaceController],
  providers: [ProjectsService, UploadService, WorkspaceService],
  exports: [ProjectsService, UploadService, WorkspaceService],
})
export class ProjectsModule {}
