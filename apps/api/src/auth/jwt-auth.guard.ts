import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('No token provided');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid token format');
    }

    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new UnauthorizedException('JWT secret key is not configured');
      }
      const payload = await this.jwtService.verifyAsync(token, {
        secret,
      });
      request.user = payload;
      return true;
    } catch (err) {
      throw new UnauthorizedException('Token validation failed');
    }
  }
}
