import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandKitsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const list = await this.prisma.brandKit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (list.length === 0) {
      // Auto seed default brand kit
      const defaultKit = await this.prisma.brandKit.create({
        data: {
          userId,
          name: 'Default Brand Kit (Purple)',
          primaryColor: '#8b5cf6',
          secondaryColor: '#06b6d4',
          textColor: '#ffffff',
          fontFamily: 'Inter',
          watermarkText: 'ClipAI.com',
        },
      });
      return [defaultKit];
    }

    return list;
  }

  async findOne(id: string, userId: string) {
    const brandKit = await this.prisma.brandKit.findFirst({
      where: { id, userId },
    });
    if (!brandKit) throw new NotFoundException('Brand kit not found');
    return brandKit;
  }

  async create(data: {
    name: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    textColor?: string;
    watermarkText?: string;
    fontFamily?: string;
  }, userId: string) {
    return this.prisma.brandKit.create({
      data: {
        ...data,
        userId,
      },
    });
  }

  async update(id: string, data: {
    name?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    textColor?: string;
    watermarkText?: string;
    fontFamily?: string;
  }, userId: string) {
    await this.findOne(id, userId); // verify ownership
    return this.prisma.brandKit.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId); // verify ownership
    return this.prisma.brandKit.delete({ where: { id } });
  }
}
