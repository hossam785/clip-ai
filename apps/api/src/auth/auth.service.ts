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

  async register(body: { email: string; passwordHash: string }) {
    const { email, passwordHash } = body;
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(passwordHash, salt);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        credits: 100, // starting free credits
      },
    });

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
