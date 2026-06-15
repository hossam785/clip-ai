import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('report')
  getReport(@CurrentUser() user: any) {
    return this.analyticsService.getUnifiedReport(user.id);
  }

  @Get('clip/:id')
  getClipPerformance(
    @Param('id') clipId: string,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getClipPerformance(user.id, clipId);
  }

  @Get('insights')
  getInsights(@CurrentUser() user: any) {
    return this.analyticsService.getAiInsights(user.id);
  }
}
