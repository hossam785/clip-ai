import { Injectable, OnModuleInit, OnModuleDestroy, Logger, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookDeliveryService } from '../developer/webhook-delivery.service';

@Injectable()
export class IntegrationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntegrationsService.name);
  private schedulerInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WebhookDeliveryService))
    private webhookDelivery: WebhookDeliveryService,
  ) {}

  onModuleInit() {
    this.logger.log('Initializing background post scheduler loop...');
    // Run the scheduler poll every 5 seconds
    this.schedulerInterval = setInterval(() => this.pollSchedules(), 5000);
  }

  onModuleDestroy() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
  }

  async getConnectedAccounts(userId: string) {
    return this.prisma.connectedAccount.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        accountName: true,
        accountId: true,
        createdAt: true,
      },
    });
  }

  async connectAccountMock(userId: string, provider: string, accountName: string) {
    const mockAccountId = `mock_acc_${provider}_${Math.floor(100000 + Math.random() * 900000)}`;
    const mockToken = `mock_oauth_access_token_${Date.now()}`;
    
    return this.prisma.connectedAccount.upsert({
      where: {
        userId_provider_accountId: {
          userId,
          provider,
          accountId: mockAccountId,
        },
      },
      update: {
        accountName,
        accessToken: mockToken,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
      },
      create: {
        userId,
        provider,
        accountId: mockAccountId,
        accountName,
        accessToken: mockToken,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });
  }

  async disconnectAccount(userId: string, accountId: string) {
    const acc = await this.prisma.connectedAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!acc) throw new BadRequestException('Connected account not found');

    return this.prisma.connectedAccount.delete({
      where: { id: accountId },
    });
  }

  async publishClipDirectly(userId: string, clipId: string, provider: string, title: string, description: string) {
    const clip = await this.prisma.clip.findUnique({
      where: { id: clipId },
      include: { project: true },
    });
    if (!clip) throw new BadRequestException('Clip not found');

    // Verify account is connected
    const account = await this.prisma.connectedAccount.findFirst({
      where: { userId, provider },
    });
    if (!account) {
      throw new BadRequestException(`No connected account found for provider: ${provider}. Connect account first.`);
    }

    // Fake successful direct publishing
    const fakedPostId = `post_${provider}_${Math.floor(1000000 + Math.random() * 9000000)}`;
    const fakedPostUrl = this.getFakedPostUrl(provider, fakedPostId, account.accountName);

    // Initial faked stats
    const views = Math.floor(Math.random() * 50);
    const likes = Math.floor(views * 0.15);
    const comments = Math.floor(likes * 0.2);
    const shares = Math.floor(likes * 0.1);

    const post = await this.prisma.publishedPost.create({
      data: {
        userId,
        clipId,
        provider,
        postId: fakedPostId,
        status: 'PUBLISHED',
        postUrl: fakedPostUrl,
        title,
        description,
        views,
        likes,
        comments,
        shares,
        watchTimeSec: views * 15,
        retentionRate: 75.5,
      },
    });

    // Notify Webhook
    await this.webhookDelivery.triggerWebhook(userId, 'POST_PUBLISHED', {
      postId: post.id,
      clipId: post.clipId,
      provider: post.provider,
      postUrl: post.postUrl,
      title: post.title,
    });

    return post;
  }

  async scheduleClipPublish(userId: string, clipId: string, provider: string, scheduledFor: Date, title: string, description: string) {
    const clip = await this.prisma.clip.findUnique({ where: { id: clipId } });
    if (!clip) throw new BadRequestException('Clip not found');

    const account = await this.prisma.connectedAccount.findFirst({
      where: { userId, provider },
    });
    if (!account) {
      throw new BadRequestException(`No connected account found for provider: ${provider}. Connect account first.`);
    }

    return this.prisma.postSchedule.create({
      data: {
        userId,
        clipId,
        provider,
        scheduledFor,
        title,
        description,
        status: 'SCHEDULED',
      },
    });
  }

  async getSchedules(userId: string) {
    return this.prisma.postSchedule.findMany({
      where: { userId },
      include: {
        clip: {
          select: {
            title: true,
            videoPath720p: true,
            videoPath1080p: true,
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  async getPublishHistory(userId: string) {
    return this.prisma.publishedPost.findMany({
      where: { userId },
      include: {
        clip: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelSchedule(userId: string, scheduleId: string) {
    const sch = await this.prisma.postSchedule.findFirst({
      where: { id: scheduleId, userId },
    });
    if (!sch) throw new BadRequestException('Scheduled post not found');

    return this.prisma.postSchedule.update({
      where: { id: scheduleId },
      data: { status: 'CANCELLED' },
    });
  }

  async duplicatePost(userId: string, postId: string) {
    const post = await this.prisma.publishedPost.findFirst({
      where: { id: postId, userId },
    });
    if (!post) throw new BadRequestException('Published post not found');

    return this.prisma.postSchedule.create({
      data: {
        userId,
        clipId: post.clipId,
        provider: post.provider,
        scheduledFor: new Date(Date.now() + 24 * 3600 * 1000), // Default to 24 hours later
        title: post.title,
        description: post.description,
        status: 'SCHEDULED',
      },
    });
  }

  /**
   * Background schedule poll loop
   */
  private async pollSchedules() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingSchedules = await this.prisma.postSchedule.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledFor: { lte: new Date() },
        },
      });

      for (const sched of pendingSchedules) {
        try {
          const account = await this.prisma.connectedAccount.findFirst({
            where: { userId: sched.userId, provider: sched.provider },
          });

          if (!account) {
            await this.prisma.postSchedule.update({
              where: { id: sched.id },
              data: { status: 'FAILED', errorMessage: 'Disconnected account or credentials missing.' },
            });
            continue;
          }

          // Publish faked post
          const fakedPostId = `post_${sched.provider}_${Math.floor(1000000 + Math.random() * 9000000)}`;
          const fakedPostUrl = this.getFakedPostUrl(sched.provider, fakedPostId, account.accountName);

          const views = Math.floor(Math.random() * 30);
          const likes = Math.floor(views * 0.12);
          const comments = Math.floor(likes * 0.15);

          const post = await this.prisma.publishedPost.create({
            data: {
              userId: sched.userId,
              clipId: sched.clipId,
              provider: sched.provider,
              postId: fakedPostId,
              status: 'PUBLISHED',
              postUrl: fakedPostUrl,
              title: sched.title,
              description: sched.description,
              views,
              likes,
              comments,
              watchTimeSec: views * 10,
              retentionRate: 70.0,
            },
          });

          await this.prisma.postSchedule.update({
            where: { id: sched.id },
            data: { status: 'PUBLISHED' },
          });

          // Notify Webhook
          await this.webhookDelivery.triggerWebhook(sched.userId, 'POST_PUBLISHED', {
            postId: post.id,
            clipId: post.clipId,
            provider: post.provider,
            postUrl: post.postUrl,
            title: post.title,
          });

          this.logger.log(`[Scheduler] Published post ID ${post.id} for user ${sched.userId} on ${sched.provider}`);
        } catch (err) {
          this.logger.error(`[Scheduler] Failed scheduling job ${sched.id}: ${err.message}`);
          await this.prisma.postSchedule.update({
            where: { id: sched.id },
            data: { status: 'FAILED', errorMessage: err.message },
          });
        }
      }
    } catch (e) {
      this.logger.error(`Error processing schedules: ${e.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private getFakedPostUrl(provider: string, postId: string, username: string): string {
    const normalizedUser = username.replace('@', '').toLowerCase();
    switch (provider) {
      case 'youtube':
        return `https://youtube.com/shorts/${postId}`;
      case 'tiktok':
        return `https://tiktok.com/@${normalizedUser}/video/${postId}`;
      case 'instagram':
        return `https://instagram.com/reel/${postId}`;
      case 'facebook':
        return `https://facebook.com/watch/?v=${postId}`;
      case 'linkedin':
        return `https://linkedin.com/posts/${normalizedUser}_clip-${postId}`;
      case 'x':
        return `https://x.com/${normalizedUser}/status/${postId}`;
      default:
        return `https://socialmedia.com/${provider}/${postId}`;
    }
  }
}
