import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';

@Injectable()
export class ReferralService {
  constructor(
    private prisma: PrismaService,
    private billingService: BillingService,
  ) {}

  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (user.referralCode) return user.referralCode;

    const code = `CLIP-${userId.slice(0, 5).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    await this.prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
    });
    return code;
  }

  async applyReferral(newUserId: string, referrerCode: string) {
    const referrer = await this.prisma.user.findUnique({ where: { referralCode: referrerCode } });
    if (!referrer) return;
    if (referrer.id === newUserId) return;

    const newUser = await this.prisma.user.findUnique({ where: { id: newUserId } });
    if (!newUser || newUser.referredById) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: newUserId },
        data: { referredById: referrer.id },
      });

      const rewardCredits = 200;
      
      await tx.user.update({
        where: { id: referrer.id },
        data: {
          credits: { increment: rewardCredits },
          bonusCredits: { increment: rewardCredits },
        },
      });

      await tx.user.update({
        where: { id: newUserId },
        data: {
          credits: { increment: rewardCredits },
          bonusCredits: { increment: rewardCredits },
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId: referrer.id,
          amount: rewardCredits,
          type: 'SIGNUP_BONUS',
          description: `Referral signup reward for inviting user ${newUser.email}`,
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId: newUserId,
          amount: rewardCredits,
          type: 'SIGNUP_BONUS',
          description: `Referral signup reward for using invite code from ${referrer.email}`,
        },
      });

      await tx.referralReward.create({
        data: {
          referrerId: referrer.id,
          referredUserId: newUserId,
          creditsAwarded: rewardCredits,
          status: 'COMPLETED',
        },
      });
    });
  }

  async getReferrals(userId: string) {
    const referrals = await this.prisma.user.findMany({
      where: { referredById: userId },
      select: { id: true, email: true, createdAt: true },
    });

    const rewards = await this.prisma.referralReward.findMany({
      where: { referrerId: userId },
    });

    return { referrals, rewards };
  }
}
