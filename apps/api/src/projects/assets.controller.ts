import { Controller, Get, Param, Query, Res, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

@Controller('static/uploads')
export class AssetsController {
  private readonly publicDir = path.join(__dirname, '..', '..', 'public');

  @Get('videos/:projectId/:fileName')
  async serveVideo(
    @Param('projectId') projectId: string,
    @Param('fileName') fileName: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() res: Response,
  ) {
    this.validateSignature(`uploads/videos/${projectId}/${fileName}`, expires, signature);

    const filePath = path.join(this.publicDir, 'uploads', 'videos', projectId, fileName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Video not found');
    }

    return res.sendFile(filePath);
  }

  @Get('thumbnails/:fileName')
  async serveThumbnail(
    @Param('fileName') fileName: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() res: Response,
  ) {
    this.validateSignature(`uploads/thumbnails/${fileName}`, expires, signature);

    const filePath = path.join(this.publicDir, 'uploads', 'thumbnails', fileName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Thumbnail not found');
    }

    return res.sendFile(filePath);
  }

  @Get('exports/:fileName')
  async serveExport(
    @Param('fileName') fileName: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() res: Response,
  ) {
    this.validateSignature(`uploads/exports/${fileName}`, expires, signature);

    const filePath = path.join(this.publicDir, 'uploads', 'exports', fileName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Exported file not found');
    }

    return res.sendFile(filePath);
  }

  private validateSignature(pathSegment: string, expires: string, signature: string) {
    if (!expires || !signature) {
      throw new UnauthorizedException('Missing signature or expiry');
    }

    const expiryTime = parseInt(expires, 10);
    if (Date.now() > expiryTime) {
      throw new UnauthorizedException('URL has expired');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('JWT Secret is not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${pathSegment}:${expires}`)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new UnauthorizedException('Invalid signature');
    }
  }
}
