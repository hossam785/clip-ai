import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(body: { email: string; passwordHash: string; referralCode?: string }) {
    const { email, passwordHash, referralCode } = body;
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(passwordHash, salt);

    // Initial user credits configuration
    let initialCredits = 100;
    let referrerId: string | null = null;
    let hasReferrer = false;

    if (referralCode) {
      const referrer = await this.prisma.user.findUnique({ where: { referralCode } });
      if (referrer && referrer.email !== email) {
        referrerId = referrer.id;
        hasReferrer = true;
        initialCredits += 200; // 200 bonus credits for the invitee
      }
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        credits: initialCredits,
        monthlyCredits: 100, // free plan baseline
        referredById: referrerId,
      },
    });

    // Award referrer and log details
    if (hasReferrer && referrerId) {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: referrerId },
          data: {
            credits: { increment: 200 },
            bonusCredits: { increment: 200 },
          },
        });

        await tx.creditTransaction.create({
          data: {
            userId: referrerId,
            amount: 200,
            type: 'SIGNUP_BONUS',
            description: `Referral bonus for inviting ${email}`,
          },
        });

        await tx.creditTransaction.create({
          data: {
            userId: user.id,
            amount: 200,
            type: 'SIGNUP_BONUS',
            description: `Referral signup bonus for using invite code`,
          },
        });

        await tx.referralReward.create({
          data: {
            referrerId,
            referredUserId: user.id,
            creditsAwarded: 200,
            status: 'COMPLETED',
          },
        });
      });
    }

    const token = await this.generateToken(user);
    return { token, user: { id: user.id, email: user.email, role: user.role, credits: user.credits } };
  }

  async login(body: { email: string; passwordHash: string }) {
    const { email, passwordHash } = body;
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(passwordHash, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this.generateToken(user);
    return { token, user: { id: user.id, email: user.email, role: user.role, credits: user.credits } };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return { id: user.id, email: user.email, role: user.role, credits: user.credits };
  }

  private async generateToken(user: any) {
    return this.jwtService.signAsync({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }
}
