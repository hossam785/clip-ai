import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';

@Injectable()
export class PromoService {
  constructor(
    private prisma: PrismaService,
    private billingService: BillingService,
  ) {}

  async createPromoCode(data: {
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED' | 'BONUS_CREDITS' | 'TRIAL_EXTENSION';
    discountValue: number;
    expiresAt?: Date;
    maxRedemptions?: number;
  }) {
    const existing = await this.prisma.promoCode.findUnique({ where: { code: data.code } });
    if (existing) throw new BadRequestException('Promo code already exists');

    return this.prisma.promoCode.create({ data });
  }

  async validateAndRedeem(userId: string, codeStr: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { code: codeStr.toUpperCase() } });
    if (!promo) throw new BadRequestException('Invalid promo code');

    if (promo.expiresAt && new Date() > promo.expiresAt) {
      throw new BadRequestException('Promo code has expired');
    }

    if (promo.maxRedemptions && promo.redemptions >= promo.maxRedemptions) {
      throw new BadRequestException('Promo code redemption limit reached');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.promoCode.update({
        where: { id: promo.id },
        data: { redemptions: { increment: 1 } },
      });

      if (promo.discountType === 'BONUS_CREDITS') {
        const credits = Math.floor(promo.discountValue);
        
        await tx.user.update({
          where: { id: userId },
          data: {
            credits: { increment: credits },
            bonusCredits: { increment: credits },
          },
        });

        await tx.creditTransaction.create({
          data: {
            userId,
            amount: credits,
            type: 'SIGNUP_BONUS',
            description: `Redeemed promo code: ${promo.code} (+${credits} credits)`,
          },
        });
      } else if (promo.discountType === 'TRIAL_EXTENSION') {
        const days = Math.floor(promo.discountValue);
        const sub = await tx.subscription.findUnique({ where: { userId } });
        if (sub) {
          const newEnd = new Date(sub.currentPeriodEnd);
          newEnd.setDate(newEnd.getDate() + days);
          await tx.subscription.update({
            where: { userId },
            data: { currentPeriodEnd: newEnd },
          });
        }
      }

      await tx.billingEvent.create({
        data: {
          userId,
          eventType: 'PROMO_REDEEMED',
          metadata: JSON.stringify({ code: promo.code, type: promo.discountType, value: promo.discountValue }),
        },
      });
    });

    return {
      message: 'Promo code redeemed successfully',
      discountType: promo.discountType,
      discountValue: promo.discountValue,
    };
  }

  async getPromoCodes() {
    return this.prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async deletePromoCode(id: string) {
    return this.prisma.promoCode.delete({ where: { id } });
  }
}
