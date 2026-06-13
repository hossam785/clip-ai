import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.user.update({
      where: { id: userId },
      data: { credits: user.credits + amount },
      select: { id: true, email: true, credits: true },
    });
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
}
