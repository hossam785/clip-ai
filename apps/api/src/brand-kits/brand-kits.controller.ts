import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { BrandKitsService } from './brand-kits.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('brand-kits')
@UseGuards(JwtAuthGuard)
export class BrandKitsController {
  constructor(private readonly brandKitsService: BrandKitsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.brandKitsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.brandKitsService.findOne(id, user.id);
  }

  @Post()
  create(
    @Body() body: {
      name: string;
      logoUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      textColor?: string;
      watermarkText?: string;
      fontFamily?: string;
    },
    @CurrentUser() user: any
  ) {
    return this.brandKitsService.create(body, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      logoUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      textColor?: string;
      watermarkText?: string;
      fontFamily?: string;
    },
    @CurrentUser() user: any
  ) {
    return this.brandKitsService.update(id, body, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.brandKitsService.remove(id, user.id);
  }
}
