import { Controller, Get, Post, Delete, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  // Keys Management
  @Get('keys')
  getKeys() {
    return this.adminService.getKeys();
  }

  @Post('keys')
  createKey(@Body() body: { key: string }) {
    return this.adminService.createKey(body.key);
  }

  @Patch('keys/:id')
  toggleKey(@Param('id') id: string, @Body() body: { status: 'ACTIVE' | 'INACTIVE' }) {
    return this.adminService.toggleKey(id, body.status);
  }

  @Delete('keys/:id')
  deleteKey(@Param('id') id: string) {
    return this.adminService.deleteKey(id);
  }

  // Users Management
  @Get('users')
  getUsers() {
    return this.adminService.getUsers();
  }

  @Patch('users/:id/credits')
  updateCredits(@Param('id') id: string, @Body() body: { amount: number }) {
    return this.adminService.updateCredits(id, body.amount);
  }

  // System Configurations
  @Get('configs')
  getConfigs() {
    return this.adminService.getConfigs();
  }

  @Patch('configs/:key')
  updateConfig(@Param('key') key: string, @Body() body: { value: string }) {
    return this.adminService.updateConfig(key, body.value);
  }
}
