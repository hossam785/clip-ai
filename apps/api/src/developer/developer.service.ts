import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class DeveloperService {
  private readonly logger = new Logger(DeveloperService.name);

  constructor(private prisma: PrismaService) {}

  // ========================
  // API KEY MANAGEMENT
  // ========================

  async getApiKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        key: true,
        status: true,
        requestLimit: true,
        requestCount: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createApiKey(userId: string, name: string) {
    const existingCount = await this.prisma.apiKey.count({
      where: { userId },
    });

    if (existingCount >= 10) {
      throw new BadRequestException('Maximum 10 API keys allowed per user.');
    }

    const rawKey = `clip_${crypto.randomBytes(24).toString('hex')}`;

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        name,
        key: rawKey,
        status: 'ACTIVE',
        requestLimit: 1000,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: apiKey.key, // Show full key only on creation
      status: apiKey.status,
      requestLimit: apiKey.requestLimit,
      createdAt: apiKey.createdAt,
    };
  }

  async revokeApiKey(userId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });
    if (!key) throw new BadRequestException('API key not found.');

    return this.prisma.apiKey.update({
      where: { id: keyId },
      data: { status: 'REVOKED' },
    });
  }

  async deleteApiKey(userId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });
    if (!key) throw new BadRequestException('API key not found.');

    return this.prisma.apiKey.delete({
      where: { id: keyId },
    });
  }

  // ========================
  // WEBHOOK SUBSCRIPTION MANAGEMENT
  // ========================

  async getWebhooks(userId: string) {
    return this.prisma.webhookSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWebhook(userId: string, url: string, events: string[]) {
    const existingCount = await this.prisma.webhookSubscription.count({
      where: { userId },
    });

    if (existingCount >= 20) {
      throw new BadRequestException('Maximum 20 webhook subscriptions allowed per user.');
    }

    const secret = `whsec_${crypto.randomBytes(16).toString('hex')}`;

    return this.prisma.webhookSubscription.create({
      data: {
        userId,
        url,
        secret,
        events: JSON.stringify(events),
        status: 'ACTIVE',
      },
    });
  }

  async updateWebhook(userId: string, webhookId: string, data: { url?: string; events?: string[]; status?: string }) {
    const wh = await this.prisma.webhookSubscription.findFirst({
      where: { id: webhookId, userId },
    });
    if (!wh) throw new BadRequestException('Webhook subscription not found.');

    const updateData: any = {};
    if (data.url) updateData.url = data.url;
    if (data.events) updateData.events = JSON.stringify(data.events);
    if (data.status) updateData.status = data.status;

    return this.prisma.webhookSubscription.update({
      where: { id: webhookId },
      data: updateData,
    });
  }

  async deleteWebhook(userId: string, webhookId: string) {
    const wh = await this.prisma.webhookSubscription.findFirst({
      where: { id: webhookId, userId },
    });
    if (!wh) throw new BadRequestException('Webhook subscription not found.');

    return this.prisma.webhookSubscription.delete({
      where: { id: webhookId },
    });
  }

  // ========================
  // WORKFLOW AUTOMATION
  // ========================

  async getWorkflowRules(userId: string) {
    return this.prisma.workflowRule.findMany({
      where: { userId },
      include: {
        executions: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWorkflowRule(
    userId: string,
    name: string,
    trigger: string,
    action: string,
    config: any,
  ) {
    return this.prisma.workflowRule.create({
      data: {
        userId,
        name,
        trigger,
        action,
        config: JSON.stringify(config || {}),
        status: 'ACTIVE',
      },
    });
  }

  async updateWorkflowRule(
    userId: string,
    ruleId: string,
    data: { name?: string; trigger?: string; action?: string; config?: any; status?: string },
  ) {
    const rule = await this.prisma.workflowRule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!rule) throw new BadRequestException('Workflow rule not found.');

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.trigger) updateData.trigger = data.trigger;
    if (data.action) updateData.action = data.action;
    if (data.config) updateData.config = JSON.stringify(data.config);
    if (data.status) updateData.status = data.status;

    return this.prisma.workflowRule.update({
      where: { id: ruleId },
      data: updateData,
    });
  }

  async deleteWorkflowRule(userId: string, ruleId: string) {
    const rule = await this.prisma.workflowRule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!rule) throw new BadRequestException('Workflow rule not found.');

    return this.prisma.workflowRule.delete({
      where: { id: ruleId },
    });
  }
}
