import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingPlanService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedPlans();
    await this.seedDefaultConfigs();
  }

  async seedPlans() {
    const plans = [
      {
        name: 'FREE',
        monthlyPrice: 0,
        annualPrice: 0,
        credits: 100,
        uploadLimitCount: 3,
        storageLimitMb: 100,
        processingLimitMin: 15,
        exportLimitCount: 3,
        teamMemberLimit: 1,
        priorityLevel: 'LOW',
        features: JSON.stringify(['3 AI Clips per video', 'Up to 720p output quality', 'Basic support']),
      },
      {
        name: 'STARTER',
        monthlyPrice: 19,
        annualPrice: 190,
        credits: 1000,
        uploadLimitCount: 10,
        storageLimitMb: 1000,
        processingLimitMin: 60,
        exportLimitCount: 10,
        teamMemberLimit: 2,
        priorityLevel: 'MEDIUM',
        features: JSON.stringify(['Unlimited AI Clips', 'Up to 1080p output quality', 'Dynamic speech reframing', 'Standard support']),
      },
      {
        name: 'PRO',
        monthlyPrice: 49,
        annualPrice: 490,
        credits: 3500,
        uploadLimitCount: 30,
        storageLimitMb: 5000,
        processingLimitMin: 200,
        exportLimitCount: 50,
        teamMemberLimit: 5,
        priorityLevel: 'HIGH',
        features: JSON.stringify([
          'Everything in Starter',
          'Ultra 4K processing capabilities',
          'Automatic smart layout presets',
          'Advanced subtitle layouts & emojis',
          'Priority support',
        ]),
      },
      {
        name: 'BUSINESS',
        monthlyPrice: 99,
        annualPrice: 990,
        credits: 8000,
        uploadLimitCount: 100,
        storageLimitMb: 20000,
        processingLimitMin: 500,
        exportLimitCount: 200,
        teamMemberLimit: 15,
        priorityLevel: 'HIGH',
        features: JSON.stringify([
          'Everything in Creator Elite',
          'Dedicated API endpoints & webhooks',
          'Custom brand presets & watermark removal',
          '24/7 dedicated support representative',
        ]),
      },
      {
        name: 'ENTERPRISE',
        monthlyPrice: 299,
        annualPrice: 2990,
        credits: 30000,
        uploadLimitCount: 1000,
        storageLimitMb: 100000,
        processingLimitMin: 2000,
        exportLimitCount: 1000,
        teamMemberLimit: 100,
        priorityLevel: 'HIGH',
        features: JSON.stringify([
          'Custom SLA & onboarding',
          'Unlimited processing power',
          'Multi-user shared workspace billing',
          'Custom contracts & payments',
        ]),
      },
    ];

    for (const plan of plans) {
      await this.prisma.subscriptionPlan.upsert({
        where: { name: plan.name },
        update: {
          monthlyPrice: plan.monthlyPrice,
          annualPrice: plan.annualPrice,
          credits: plan.credits,
          uploadLimitCount: plan.uploadLimitCount,
          storageLimitMb: plan.storageLimitMb,
          processingLimitMin: plan.processingLimitMin,
          exportLimitCount: plan.exportLimitCount,
          teamMemberLimit: plan.teamMemberLimit,
          priorityLevel: plan.priorityLevel,
          features: plan.features,
        },
        create: plan,
      });
    }
  }

  async seedDefaultConfigs() {
    const configs = [
      { key: 'cost_video_upload', value: '5' },
      { key: 'cost_transcription_per_min', value: '2' },
      { key: 'cost_ai_analysis_per_min', value: '3' },
      { key: 'cost_captions_per_min', value: '1' },
      { key: 'cost_reframing_per_min', value: '2' },
      { key: 'cost_export_per_clip', value: '5' },
      { key: 'cost_storage_per_mb_month', value: '0.1' },
    ];

    for (const conf of configs) {
      const existing = await this.prisma.systemConfig.findUnique({ where: { key: conf.key } });
      if (!existing) {
        await this.prisma.systemConfig.create({ data: conf });
      }
    }
  }
}
