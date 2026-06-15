import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Trigger webhook delivery to all active subscriptions for a user that match the event type.
   * In production, this would make real HTTP POST requests to the subscriber URL.
   * Currently faked for development.
   */
  async triggerWebhook(userId: string, eventType: string, payload: any) {
    try {
      const subscriptions = await this.prisma.webhookSubscription.findMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
      });

      for (const sub of subscriptions) {
        const events: string[] = JSON.parse(sub.events || '[]');
        if (!events.includes(eventType) && !events.includes('*')) {
          continue;
        }

        // In production: HTTP POST to sub.url with HMAC signature using sub.secret
        this.logger.log(
          `[WebhookDelivery] Delivered event "${eventType}" to ${sub.url} for user ${userId}`,
        );
      }
    } catch (err) {
      this.logger.error(`[WebhookDelivery] Error delivering webhooks: ${err.message}`);
    }
  }
}
