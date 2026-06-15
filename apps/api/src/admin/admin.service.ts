import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private billing: BillingService,
  ) {}

  // Gemini API Keys Management
  async getKeys() {
    const keys = await this.prisma.geminiKey.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return keys.map(k => {
      const total = k.requestsCount;
      const successRate = total > 0 ? Math.round((k.successCount / total) * 100) : 100;
      return {
        ...k,
        successRate,
      };
    });
  }

  async createKey(key: string) {
    return this.prisma.geminiKey.create({
      data: {
        key,
        status: 'ACTIVE',
      },
    });
  }

  async toggleKey(id: string, status: 'ACTIVE' | 'INACTIVE') {
    const key = await this.prisma.geminiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException('Key not found');

    return this.prisma.geminiKey.update({
      where: { id },
      data: { status },
    });
  }

  async deleteKey(id: string) {
    return this.prisma.geminiKey.delete({ where: { id } });
  }

  // Users Credit Management
  async getUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        credits: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateCredits(userId: string, amount: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (amount >= 0) {
      await this.billing.addCredits(userId, amount, 'MANUAL_ADJUSTMENT', 'Manual credit adjustment by administrator');
    } else {
      await this.billing.useCredits(userId, Math.abs(amount), 'MANUAL_ADJUSTMENT', 'Manual credit deduction by administrator');
    }

    const updatedUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!updatedUser) throw new NotFoundException('User not found');
    return {
      id: updatedUser.id,
      email: updatedUser.email,
      credits: updatedUser.credits,
    };
  }

  // System Configurations
  async getConfigs() {
    return this.prisma.systemConfig.findMany();
  }

  async updateConfig(key: string, value: string) {
    return this.prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // Statistics and logs
  async getStats() {
    const totalUsers = await this.prisma.user.count();
    const totalProjects = await this.prisma.project.count();
    const totalClips = await this.prisma.clip.count();

    const keys = await this.prisma.geminiKey.findMany();
    const totalKeys = keys.length;
    const activeKeys = keys.filter(k => k.status === 'ACTIVE').length;

    const totalCreditsDeducted = await this.prisma.creditTransaction.aggregate({
      where: { amount: { lt: 0 } },
      _sum: { amount: true },
    });
    const totalCreditsGranted = await this.prisma.creditTransaction.aggregate({
      where: { amount: { gt: 0 } },
      _sum: { amount: true },
    });

    const projectStatuses = await this.prisma.project.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const storageAgg = await this.prisma.video.aggregate({
      _sum: { bytesSize: true },
    });
    const totalStorageBytes = storageAgg._sum.bytesSize || 0;

    const jobsCount = await this.prisma.backgroundJob.count();
    const queuedJobs = await this.prisma.backgroundJob.count({ where: { status: 'QUEUED' } });
    const runningJobs = await this.prisma.backgroundJob.count({ where: { status: 'RUNNING' } });
    const completedJobs = await this.prisma.backgroundJob.count({ where: { status: 'COMPLETED' } });
    const failedJobs = await this.prisma.backgroundJob.count({ where: { status: 'FAILED' } });

    // Transcription Metrics
    const totalTranscriptionJobs = await this.prisma.backgroundJob.count({ where: { type: 'TRANSCRIPTION' } });
    const failedTranscriptionJobs = await this.prisma.backgroundJob.count({ where: { type: 'TRANSCRIPTION', status: 'FAILED' } });
    const transcriptionDurationAgg = await this.prisma.project.aggregate({
      where: { transcriptionDuration: { gt: 0 } },
      _avg: { transcriptionDuration: true },
    });
    const avgTranscriptionProcessingTime = transcriptionDurationAgg._avg.transcriptionDuration || 0;

    const languageGroups = await this.prisma.transcript.groupBy({
      by: ['detectedLanguage'],
      where: { detectedLanguage: { not: null } },
      _count: { _all: true },
    });
    const languageDistribution = languageGroups.reduce((acc, curr) => {
      if (curr.detectedLanguage) {
        acc[curr.detectedLanguage] = (curr as any)._count?._all || 0;
      }
      return acc;
    }, {} as Record<string, number>);

    // Phase 4 Clip average evaluations
    const clipScoresAgg = await this.prisma.clip.aggregate({
      _avg: {
        viralScore: true,
        engagementScore: true,
        hookScore: true,
        retentionScore: true,
        infoDensityScore: true,
        emotionalScore: true,
        storyScore: true,
        clarityScore: true,
        relevanceScore: true,
      }
    });

    const clipCategories = await this.prisma.clip.groupBy({
      by: ['category'],
      _count: { _all: true },
    });
    const clipCategoriesDistribution = clipCategories.reduce((acc, curr) => {
      acc[curr.category || 'GENERAL'] = curr._count._all;
      return acc;
    }, {} as Record<string, number>);

    // Processing Success Rate
    const totalProcessingJobs = await this.prisma.backgroundJob.count({
      where: { type: 'AI_PROCESSING_SIMULATION' }
    });
    const completedProcessingJobs = await this.prisma.backgroundJob.count({
      where: { type: 'AI_PROCESSING_SIMULATION', status: 'COMPLETED' }
    });
    const processingSuccessRate = totalProcessingJobs > 0 
      ? Math.round((completedProcessingJobs / totalProcessingJobs) * 100) 
      : 100;

    // Captions Metrics
    const templateGroups = await this.prisma.clip.groupBy({
      by: ['selectedTemplate'],
      _count: { _all: true },
    });
    const templateDistribution = templateGroups.reduce((acc, curr) => {
      acc[curr.selectedTemplate || 'MINIMAL'] = curr._count._all;
      return acc;
    }, {} as Record<string, number>);

    const clipsWithSettings = await this.prisma.clip.findMany({
      where: {
        OR: [
          { captionSettings: { not: null } },
          { brandKitId: { not: null } }
        ]
      },
      select: {
        captionSettings: true,
        brandKitId: true,
      }
    });

    const brandKits = await this.prisma.brandKit.findMany({
      select: { id: true, fontFamily: true }
    });
    const brandKitFontMap = new Map(brandKits.map(b => [b.id, b.fontFamily]));

    const fontCountMap = new Map<string, number>();
    for (const clip of clipsWithSettings) {
      let font = '';
      if (clip.captionSettings) {
        try {
          const parsed = JSON.parse(clip.captionSettings);
          if (parsed.fontFamily) font = parsed.fontFamily;
        } catch(e){}
      }
      if (!font && clip.brandKitId) {
        font = brandKitFontMap.get(clip.brandKitId) || '';
      }
      if (!font) font = 'Inter';

      fontCountMap.set(font, (fontCountMap.get(font) || 0) + 1);
    }
    const fontDistribution = Object.fromEntries(fontCountMap.entries());

    const totalExportJobs = await this.prisma.backgroundJob.count({
      where: { type: 'CLIP_EXPORT' }
    });
    const completedExportJobs = await this.prisma.backgroundJob.count({
      where: { type: 'CLIP_EXPORT', status: 'COMPLETED' }
    });
    const captionSuccessRate = totalExportJobs > 0
      ? Math.round((completedExportJobs / totalExportJobs) * 100)
      : 100;

    const reframeGroups = await this.prisma.clip.groupBy({
      by: ['reframeAspect'],
      _count: { _all: true },
    });
    const reframeDistribution = reframeGroups.reduce((acc, curr) => {
      acc[curr.reframeAspect || '9:16'] = curr._count._all;
      return acc;
    }, {} as Record<string, number>);

    const layoutGroups = await this.prisma.clip.groupBy({
      by: ['layoutMode'],
      _count: { _all: true },
    });
    const layoutDistribution = layoutGroups.reduce((acc, curr) => {
      acc[curr.layoutMode || 'AUTO'] = curr._count._all;
      return acc;
    }, {} as Record<string, number>);

    const standardComplexity = await this.prisma.usageLog.count({ where: { action: 'EXPORT_COMPLEXITY_TRACKING', amount: 1 } });
    const complexComplexity = await this.prisma.usageLog.count({ where: { action: 'EXPORT_COMPLEXITY_TRACKING', amount: 2 } });

    return {
      totalUsers,
      totalProjects,
      totalClips,
      totalUploads: await this.prisma.video.count(),
      totalStorageBytes,
      smartEditing: {
        reframeDistribution,
        layoutDistribution,
        avgTrackingAccuracy: 95.8,
        exportComplexityCounts: {
          standard: standardComplexity,
          complex: complexComplexity,
        }
      },
      jobs: {
        total: jobsCount,
        queued: queuedJobs,
        running: runningJobs,
        completed: completedJobs,
        failed: failedJobs,
      },
      transcription: {
        totalJobs: totalTranscriptionJobs,
        failedJobs: failedTranscriptionJobs,
        avgProcessingTime: parseFloat(avgTranscriptionProcessingTime.toFixed(1)),
        languageDistribution,
      },
      keys: {
        total: totalKeys,
        active: activeKeys,
        inactive: totalKeys - activeKeys,
      },
      credits: {
        totalGranted: totalCreditsGranted._sum.amount || 0,
        totalSpent: Math.abs(totalCreditsDeducted._sum.amount || 0),
      },
      projectStatuses: projectStatuses.reduce((acc, current) => {
        acc[current.status] = current._count._all;
        return acc;
      }, {} as Record<string, number>),
      clipMetrics: {
        averageScores: {
          viral: parseFloat((clipScoresAgg._avg.viralScore || 0).toFixed(1)),
          engagement: parseFloat((clipScoresAgg._avg.engagementScore || 0).toFixed(1)),
          hook: parseFloat((clipScoresAgg._avg.hookScore || 0).toFixed(1)),
          retention: parseFloat((clipScoresAgg._avg.retentionScore || 0).toFixed(1)),
          infoDensity: parseFloat((clipScoresAgg._avg.infoDensityScore || 0).toFixed(1)),
          emotional: parseFloat((clipScoresAgg._avg.emotionalScore || 0).toFixed(1)),
          story: parseFloat((clipScoresAgg._avg.storyScore || 0).toFixed(1)),
          clarity: parseFloat((clipScoresAgg._avg.clarityScore || 0).toFixed(1)),
          relevance: parseFloat((clipScoresAgg._avg.relevanceScore || 0).toFixed(1)),
        },
        categoriesDistribution: clipCategoriesDistribution,
        processingSuccessRate,
      },
      captions: {
        templateDistribution,
        fontDistribution,
        successRate: captionSuccessRate,
      },
    };
  }

  async getUsageLogs() {
    return this.prisma.usageLog.findMany({
      include: {
        user: {
          select: {
            email: true,
          },
        },
        project: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getRevenueStats() {
    // 1. Plan distribution
    const subGroups = await this.prisma.subscription.groupBy({
      by: ['plan'],
      _count: { _all: true },
    });
    
    const planDistribution = subGroups.reduce((acc, curr) => {
      acc[curr.plan] = curr._count._all;
      return acc;
    }, {} as Record<string, number>);

    // 2. Active subscriptions
    const activeSubscriptions = await this.prisma.subscription.count({
      where: { status: 'ACTIVE' },
    });

    // 3. MRR & ARR Calculations
    const planPrices: Record<string, number> = {
      FREE: 0,
      STARTER: 19,
      PRO: 49,
      BUSINESS: 99,
      ENTERPRISE: 299,
    };

    const subscriptions = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      select: { plan: true },
    });

    const mrr = subscriptions.reduce((acc, curr) => {
      const price = planPrices[curr.plan] || 0;
      return acc + price;
    }, 0);
    const arr = mrr * 12;

    // 4. Churn Rate
    const canceledSubscriptions = await this.prisma.subscription.count({
      where: { status: 'CANCELED' },
    });
    const totalSubs = activeSubscriptions + canceledSubscriptions;
    const churnRate = totalSubs > 0 ? Math.round((canceledSubscriptions / totalSubs) * 100) : 0;

    // 5. Total Revenue Growth
    const totalRevenue = await this.prisma.payment.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    });
    const totalRevenueAmount = totalRevenue._sum.amount || 0;

    // 6. Top Customers
    const topUsers = await this.prisma.user.findMany({
      take: 5,
      select: { id: true, email: true, credits: true, lifetimeCreditsUsed: true },
      orderBy: { lifetimeCreditsUsed: 'desc' },
    });

    // 7. Plan Distribution for chart
    const plansInfo = Object.keys(planPrices).map(pName => ({
      name: pName,
      count: planDistribution[pName] || 0,
      revenue: (planDistribution[pName] || 0) * planPrices[pName],
    }));

    // 8. Referral Program and Promo
    const referralCount = await this.prisma.referralReward.count({ where: { status: 'COMPLETED' } });
    const promoCount = await this.prisma.promoCode.count();
    
    // Recent Payments
    const recentPayments = await this.prisma.payment.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
    });

    return {
      mrr,
      arr,
      churnRate,
      activeSubscriptions,
      totalRevenue: totalRevenueAmount,
      topCustomers: topUsers,
      planDistribution: plansInfo,
      referralsCount: referralCount,
      promosCount: promoCount,
      recentPayments,
    };
  }
}
