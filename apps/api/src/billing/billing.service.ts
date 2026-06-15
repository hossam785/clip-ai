import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true, monthlyCredits: true, bonusCredits: true, lifetimeCreditsUsed: true },
    });
    if (!user) throw new NotFoundException('User not found');

    let subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      const endYear = new Date();
      endYear.setFullYear(endYear.getFullYear() + 1);
      subscription = await this.prisma.subscription.create({
        data: {
          userId,
          plan: 'FREE',
          status: 'ACTIVE',
          currentPeriodEnd: endYear,
        },
      });
    }

    return {
      credits: user.credits,
      monthlyCredits: user.monthlyCredits,
      bonusCredits: user.bonusCredits,
      lifetimeCreditsUsed: user.lifetimeCreditsUsed,
      subscription,
    };
  }

  async getTransactions(userId: string) {
    return this.prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addCredits(userId: string, amount: number, type: string, description: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          type,
          description,
        },
      });

      return { credits: updatedUser.credits, transaction };
    });
  }

  async useCredits(userId: string, amount: number, type: string, description: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      if (user.credits < amount) {
        throw new BadRequestException(
          `Insufficient credits! This action requires ${amount} credits, but you only have ${user.credits} credits.`
        );
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          credits: { decrement: amount },
          lifetimeCreditsUsed: { increment: amount },
        },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          type,
          description,
        },
      });

      return { credits: updatedUser.credits, transaction };
    });
  }

  async createOrUpdateSubscription(userId: string, plan: string, status: string, currentPeriodEnd: Date) {
    return this.prisma.subscription.upsert({
      where: { userId },
      update: {
        plan,
        status,
        currentPeriodEnd,
      },
      create: {
        userId,
        plan,
        status,
        currentPeriodEnd,
      },
    });
  }

  async checkUploadLimit(userId: string) {
    const balance = await this.getBalance(userId);
    const planName = balance.subscription.plan;
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { name: planName } });
    if (!plan) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const uploadCount = await this.prisma.project.count({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    if (uploadCount >= plan.uploadLimitCount) {
      throw new BadRequestException(
        `Upload limit exceeded! Your current plan (${planName}) allows up to ${plan.uploadLimitCount} uploads per month. Please upgrade your subscription.`
      );
    }
  }

  async checkStorageLimit(userId: string, newFileBytes: number) {
    const balance = await this.getBalance(userId);
    const planName = balance.subscription.plan;
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { name: planName } });
    if (!plan) return;

    const videos = await this.prisma.video.findMany({
      where: { project: { userId } },
      select: { bytesSize: true },
    });
    
    const currentBytes = videos.reduce((acc, curr) => acc + curr.bytesSize, 0);
    const totalMb = (currentBytes + newFileBytes) / (1024 * 1024);

    if (totalMb > plan.storageLimitMb) {
      throw new BadRequestException(
        `Storage limit exceeded! This file puts your storage usage at ${totalMb.toFixed(1)}MB, exceeding your plan limit of ${plan.storageLimitMb}MB.`
      );
    }
  }

  async checkExportLimit(userId: string) {
    const balance = await this.getBalance(userId);
    const planName = balance.subscription.plan;
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { name: planName } });
    if (!plan) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usageCount = await this.prisma.usageLog.count({
      where: {
        userId,
        action: 'CLIP_EXPORT',
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    if (usageCount >= plan.exportLimitCount) {
      throw new BadRequestException(
        `Export limit exceeded! Your current plan (${planName}) allows up to ${plan.exportLimitCount} clip exports per month.`
      );
    }
  }

  async getPlans() {
    const dbPlans = await this.prisma.subscriptionPlan.findMany({
      orderBy: { monthlyPrice: 'asc' },
    });

    if (dbPlans.length > 0) {
      return dbPlans.map(p => ({
        id: p.id,
        name: p.name,
        price: p.monthlyPrice,
        annualPrice: p.annualPrice,
        credits: p.credits,
        uploadLimitCount: p.uploadLimitCount,
        storageLimitMb: p.storageLimitMb,
        processingLimitMin: p.processingLimitMin,
        exportLimitCount: p.exportLimitCount,
        teamMemberLimit: p.teamMemberLimit,
        priorityLevel: p.priorityLevel,
        features: JSON.parse(p.features),
      }));
    }

    return [
      {
        id: 'plan_free',
        name: 'FREE',
        price: 0,
        credits: 100,
        features: ['3 AI Clips per video', 'Up to 720p output quality', 'Basic support'],
      },
      {
        id: 'plan_starter',
        name: 'STARTER',
        price: 19,
        credits: 1000,
        features: ['Unlimited AI Clips', 'Up to 1080p output quality', 'Dynamic speech reframing', 'Standard support'],
      },
      {
        id: 'plan_pro',
        name: 'PRO',
        price: 49,
        credits: 3500,
        features: [
          'Everything in Starter Pro',
          'Ultra 4K processing capabilities',
          'Automatic smart layout presets',
          'Advanced subtitle layouts & emojis',
          'Priority support',
        ],
      },
      {
        id: 'plan_enterprise',
        name: 'ENTERPRISE',
        price: 149,
        credits: 12000,
        features: [
          'Everything in Creator Elite',
          'Dedicated API endpoints & webhooks',
          'Custom brand presets & watermark removal',
          '24/7 dedicated support representative',
        ],
      },
    ];
  }
}
