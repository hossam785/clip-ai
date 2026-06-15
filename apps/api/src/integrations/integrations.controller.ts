import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private integrationsService: IntegrationsService) {}

  @Get('accounts')
  getAccounts(@CurrentUser() user: any) {
    return this.integrationsService.getConnectedAccounts(user.id);
  }

  @Post('connect-mock')
  connectMock(
    @Body() body: { provider: string; accountName: string },
    @CurrentUser() user: any,
  ) {
    return this.integrationsService.connectAccountMock(user.id, body.provider, body.accountName);
  }

  @Delete('accounts/:id')
  disconnectAccount(
    @Param('id') accountId: string,
    @CurrentUser() user: any,
  ) {
    return this.integrationsService.disconnectAccount(user.id, accountId);
  }

  @Post('publish')
  publishDirectly(
    @Body() body: { clipId: string; provider: string; title: string; description: string },
    @CurrentUser() user: any,
  ) {
    return this.integrationsService.publishClipDirectly(user.id, body.clipId, body.provider, body.title, body.description);
  }

  @Post('schedule')
  schedulePublish(
    @Body() body: { clipId: string; provider: string; scheduledFor: string; title: string; description: string },
    @CurrentUser() user: any,
  ) {
    return this.integrationsService.scheduleClipPublish(
      user.id,
      body.clipId,
      body.provider,
      new Date(body.scheduledFor),
      body.title,
      body.description,
    );
  }

  @Get('schedules')
  getSchedules(@CurrentUser() user: any) {
    return this.integrationsService.getSchedules(user.id);
  }

  @Get('history')
  getHistory(@CurrentUser() user: any) {
    return this.integrationsService.getPublishHistory(user.id);
  }

  @Delete('schedules/:id')
  cancelSchedule(
    @Param('id') scheduleId: string,
    @CurrentUser() user: any,
  ) {
    return this.integrationsService.cancelSchedule(user.id, scheduleId);
  }

  @Post('duplicate/:postId')
  duplicatePost(
    @Param('postId') postId: string,
    @CurrentUser() user: any,
  ) {
    return this.integrationsService.duplicatePost(user.id, postId);
  }
}
