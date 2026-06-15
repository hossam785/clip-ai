import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { DeveloperService } from './developer.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('developer')
@UseGuards(JwtAuthGuard)
export class DeveloperController {
  constructor(private developerService: DeveloperService) {}

  // ========================
  // API KEYS
  // ========================

  @Get('api-keys')
  getApiKeys(@CurrentUser() user: any) {
    return this.developerService.getApiKeys(user.id);
  }

  @Post('api-keys')
  createApiKey(
    @Body() body: { name: string },
    @CurrentUser() user: any,
  ) {
    return this.developerService.createApiKey(user.id, body.name);
  }

  @Put('api-keys/:id/revoke')
  revokeApiKey(
    @Param('id') keyId: string,
    @CurrentUser() user: any,
  ) {
    return this.developerService.revokeApiKey(user.id, keyId);
  }

  @Delete('api-keys/:id')
  deleteApiKey(
    @Param('id') keyId: string,
    @CurrentUser() user: any,
  ) {
    return this.developerService.deleteApiKey(user.id, keyId);
  }

  // ========================
  // WEBHOOKS
  // ========================

  @Get('webhooks')
  getWebhooks(@CurrentUser() user: any) {
    return this.developerService.getWebhooks(user.id);
  }

  @Post('webhooks')
  createWebhook(
    @Body() body: { url: string; events: string[] },
    @CurrentUser() user: any,
  ) {
    return this.developerService.createWebhook(user.id, body.url, body.events);
  }

  @Put('webhooks/:id')
  updateWebhook(
    @Param('id') webhookId: string,
    @Body() body: { url?: string; events?: string[]; status?: string },
    @CurrentUser() user: any,
  ) {
    return this.developerService.updateWebhook(user.id, webhookId, body);
  }

  @Delete('webhooks/:id')
  deleteWebhook(
    @Param('id') webhookId: string,
    @CurrentUser() user: any,
  ) {
    return this.developerService.deleteWebhook(user.id, webhookId);
  }

  // ========================
  // WORKFLOW RULES
  // ========================

  @Get('workflows')
  getWorkflows(@CurrentUser() user: any) {
    return this.developerService.getWorkflowRules(user.id);
  }

  @Post('workflows')
  createWorkflow(
    @Body() body: { name: string; trigger: string; action: string; config?: any },
    @CurrentUser() user: any,
  ) {
    return this.developerService.createWorkflowRule(user.id, body.name, body.trigger, body.action, body.config);
  }

  @Put('workflows/:id')
  updateWorkflow(
    @Param('id') ruleId: string,
    @Body() body: { name?: string; trigger?: string; action?: string; config?: any; status?: string },
    @CurrentUser() user: any,
  ) {
    return this.developerService.updateWorkflowRule(user.id, ruleId, body);
  }

  @Delete('workflows/:id')
  deleteWorkflow(
    @Param('id') ruleId: string,
    @CurrentUser() user: any,
  ) {
    return this.developerService.deleteWorkflowRule(user.id, ruleId);
  }
}
