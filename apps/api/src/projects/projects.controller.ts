import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFile, Query, Res } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('pricing')
  getPricing() {
    return this.projectsService.getPricing();
  }

  @Post()
  create(
    @Body() body: {
      name: string;
      youtubeUrl?: string;
      mode: 'AUTO' | 'MANUAL';
      maxDuration: string;
      manualClips?: { startTime: string; endTime: string }[];
      effects: boolean;
    },
    @CurrentUser() user: any
  ) {
    return this.projectsService.create({ ...body, userId: user.id });
  }

  @Post('import')
  importVideo(
    @Body() body: { youtubeUrl: string; name?: string },
    @CurrentUser() user: any
  ) {
    return this.projectsService.importVideo(body.youtubeUrl, body.name, user.id);
  }

  @Post('upload-chunk')
  @UseInterceptors(FileInterceptor('file'))
  uploadChunk(
    @Body() body: { projectId: string; chunkIndex: string; totalChunks: string; fileName: string },
    @UploadedFile() file: any,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.handleChunkUpload({
      projectId: body.projectId,
      chunkIndex: parseInt(body.chunkIndex, 10),
      totalChunks: parseInt(body.totalChunks, 10),
      fileName: body.fileName,
      buffer: file.buffer,
      userId: user.id,
    });
  }

  @Post(':id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.archiveProject(id, user.id);
  }

  @Post(':id/unarchive')
  unarchive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.unarchiveProject(id, user.id);
  }

  @Patch(':id')
  rename(
    @Param('id') id: string,
    @Body() body: { name: string },
    @CurrentUser() user: any
  ) {
    return this.projectsService.renameProject(id, body.name, user.id);
  }

  @Get(':id/jobs')
  getJobs(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.getProjectJobs(id, user.id);
  }

  @Get(':id/transcript')
  getTranscript(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.getProjectTranscript(id, user.id);
  }

  @Post(':id/process')
  processProject(
    @Param('id') id: string,
    @Body() body: {
      mode: 'AUTO' | 'MANUAL';
      maxDuration: string;
      manualClips?: { startTime: string; endTime: string }[];
      effects: boolean;
    },
    @CurrentUser() user: any
  ) {
    return this.projectsService.processProject(id, body, user.id);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.projectsService.findAll(user.id);
  }

  @Get(':id/clips')
  getClips(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.findClips(id, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.findOne(id, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.remove(id, user.id);
  }

  @Patch('clips/:clipId')
  updateClip(
    @Param('clipId') clipId: string,
    @Body() body: {
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
    },
    @CurrentUser() user: any,
  ) {
    return this.projectsService.updateClip(clipId, body, user.id);
  }

  @Delete('clips/:clipId')
  deleteClip(@Param('clipId') clipId: string, @CurrentUser() user: any) {
    return this.projectsService.deleteClip(clipId, user.id);
  }

  @Post('clips/:clipId/regenerate')
  regenerateClip(@Param('clipId') clipId: string, @CurrentUser() user: any) {
    return this.projectsService.regenerateClip(clipId, user.id);
  }

  @Post('clips/:clipId/export')
  exportClip(
    @Param('clipId') clipId: string,
    @Body() body: { quality: '720p' | '1080p' },
    @CurrentUser() user: any
  ) {
    return this.projectsService.exportClip(clipId, body.quality, user.id);
  }

  @Get('clips/:clipId/captions/export')
  async exportCaptions(
    @Param('clipId') clipId: string,
    @Query('format') format: 'srt' | 'vtt',
    @Res() res: Response,
    @CurrentUser() user: any,
  ) {
    const content = await this.projectsService.exportCaptions(clipId, format || 'srt', user.id);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="clip-${clipId}.${format || 'srt'}"`);
    return res.send(content);
  }

  @Patch('clips/:clipId/favorite')
  favoriteClip(
    @Param('clipId') clipId: string,
    @Body() body: { isFavorite: boolean },
    @CurrentUser() user: any,
  ) {
    return this.projectsService.favoriteClip(clipId, body.isFavorite, user.id);
  }
}
