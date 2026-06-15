import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSQLite3 } from '@prisma/adapter-better-sqlite3';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const dbPath = path.resolve(process.cwd(), '../../prisma/dev.db');
    const adapter = new PrismaBetterSQLite3({ url: `file:${dbPath}` });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    await this.seed();
  }

  private async seed() {
    // Seed default configs
    const configs = [
      { key: 'price_per_clip', value: '10' },
      { key: 'price_custom_range', value: '15' },
      { key: 'price_effects', value: '10' },
    ];

    for (const config of configs) {
      const existing = await this.systemConfig.findUnique({ where: { key: config.key } });
      if (!existing) {
        await this.systemConfig.create({ data: config });
        console.log(`[Seed] SystemConfig seeded: ${config.key} = ${config.value}`);
      }
    }

    // Seed default Gemini Keys
    const defaultKey = process.env.GEMINI_API_KEY || 'AIzaSyMockDefaultRotationKey';
    const keyCount = await this.geminiKey.count();
    if (keyCount === 0) {
      await this.geminiKey.create({
        data: {
          key: defaultKey,
          status: 'ACTIVE',
        },
      });
      console.log(`[Seed] Default GeminiKey seeded.`);
    }

    // Seed User's Gemini API Key
    const userGeminiKey = 'AIzaSyMockUserApiKeyPlaceholder';
    const userKeyExists = await this.geminiKey.findUnique({ where: { key: userGeminiKey } });
    if (!userKeyExists) {
      await this.geminiKey.create({
        data: {
          key: userGeminiKey,
          status: 'ACTIVE',
        },
      });
      console.log(`[Seed] User's Gemini API Key seeded.`);
    }

    // Seed default admin and user
    const userCount = await this.user.count();
    if (userCount === 0) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('password123', salt);

      await this.user.create({
        data: {
          email: 'admin@clipai.com',
          passwordHash,
          role: 'ADMIN',
          credits: 1000,
        },
      });

      await this.user.create({
        data: {
          email: 'user@clipai.com',
          passwordHash,
          role: 'USER',
          credits: 150,
        },
      });

      console.log(`[Seed] Seeded default admin (admin@clipai.com) and user (user@clipai.com) with password: password123`);
    }

    // Seed subscriptions and credit transaction logs for existing users
    const allUsers = await this.user.findMany();
    for (const u of allUsers) {
      // 1. Subscription
      const hasSub = await this.subscription.findUnique({ where: { userId: u.id } });
      if (!hasSub) {
        const endPeriod = new Date();
        endPeriod.setFullYear(endPeriod.getFullYear() + 1);
        await this.subscription.create({
          data: {
            userId: u.id,
            plan: u.role === 'ADMIN' ? 'ENTERPRISE' : 'FREE',
            status: 'ACTIVE',
            currentPeriodEnd: endPeriod,
          },
        });
        console.log(`[Seed] Seeded default subscription for user ${u.email}`);
      }

      // 2. Initial credits log
      const txCount = await this.creditTransaction.count({ where: { userId: u.id } });
      if (txCount === 0) {
        await this.creditTransaction.create({
          data: {
            userId: u.id,
            amount: u.credits,
            type: 'SIGNUP_BONUS',
            description: 'Starting wallet credits',
          },
        });
        console.log(`[Seed] Seeded initial credits transaction log for user ${u.email}`);
      }
    }
  }
}
