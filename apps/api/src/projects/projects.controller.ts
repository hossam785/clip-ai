import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

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
  getClips(@Param('id') id: string) {
    return this.projectsService.findClips(id);
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
    @Body() body: { title?: string; startTime?: string; endTime?: string }
  ) {
    return this.projectsService.updateClip(clipId, body);
  }

  @Delete('clips/:clipId')
  deleteClip(@Param('clipId') clipId: string) {
    return this.projectsService.deleteClip(clipId);
  }

  @Post('clips/:clipId/regenerate')
  regenerateClip(@Param('clipId') clipId: string) {
    return this.projectsService.regenerateClip(clipId);
  }
}
