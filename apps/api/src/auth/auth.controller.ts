import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() body: { email: string; passwordHash: string; referralCode?: string }) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: { email: string; passwordHash: string }) {
    return this.authService.login(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.id);
  }
}
