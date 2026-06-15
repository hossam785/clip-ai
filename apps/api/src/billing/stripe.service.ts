import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: any = null;

  constructor(
    private prisma: PrismaService,
    private billingService: BillingService,
  ) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2025-02-17-previews' as any });
      this.logger.log('Stripe SDK initialized successfully.');
    } else {
      this.logger.warn('Stripe key is missing. Running in SIMULATION MODE.');
    }
  }

  isSimulationMode(): boolean {
    return this.stripe === null;
  }

  async createCheckoutSession(userId: string, planName: string, interval: 'monthly' | 'yearly') {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { name: planName } });
    if (!plan) throw new BadRequestException('Subscription plan not found');

    if (this.isSimulationMode()) {
      const mockSessionId = `mock_session_sub_${planName.toLowerCase()}_${Date.now()}`;
      return {
        url: `http://localhost:3000/dashboard/billing?session_id=${mockSessionId}&plan=${planName}&interval=${interval}`,
        sessionId: mockSessionId,
      };
    }

    const priceId = interval === 'yearly' ? plan.stripeAnnualPriceId : plan.stripeMonthlyPriceId;
    if (!priceId) {
      throw new BadRequestException(`Stripe price ID not configured for plan: ${planName} (${interval})`);
    }

    let sub = await this.prisma.subscription.findUnique({ where: { userId } });
    let stripeCustomerId = sub?.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await this.stripe!.customers.create({
        email: user.email,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
    }

    const session = await this.stripe!.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `http://localhost:3000/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:3000/dashboard/billing?cancelled=true`,
      client_reference_id: userId,
      metadata: { userId, planName, interval },
    });

    return { url: session.url, sessionId: session.id };
  }

  async purchaseCreditsSession(userId: string, amount: number) {
    const priceCents = amount; // e.g. 1000 credits = $10.00 (1000 cents)
    
    if (this.isSimulationMode()) {
      const mockSessionId = `mock_session_credits_${amount}_${Date.now()}`;
      return {
        url: `http://localhost:3000/dashboard/billing?session_id=${mockSessionId}&credits=${amount}`,
        sessionId: mockSessionId,
      };
    }

    let sub = await this.prisma.subscription.findUnique({ where: { userId } });
    let stripeCustomerId = sub?.stripeCustomerId;

    if (!stripeCustomerId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const customer = await this.stripe!.customers.create({
        email: user?.email,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
    }

    const session = await this.stripe!.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Add ${amount} Credits`,
              description: 'One-time credit refill for Clip AI',
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      success_url: `http://localhost:3000/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:3000/dashboard/billing?cancelled=true`,
      client_reference_id: userId,
      metadata: { userId, type: 'credits', amount: amount.toString() },
    });

    return { url: session.url, sessionId: session.id };
  }

  async createPortalSession(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub || !sub.stripeCustomerId) {
      throw new BadRequestException('Stripe customer has not been initialized yet.');
    }

    if (this.isSimulationMode()) {
      return { url: `http://localhost:3000/dashboard/billing` };
    }

    const session = await this.stripe!.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `http://localhost:3000/dashboard/billing`,
    });

    return { url: session.url };
  }

  async fulfillSimulationSession(sessionId: string, userId: string) {
    if (sessionId.startsWith('mock_session_sub_')) {
      const parts = sessionId.split('_');
      const planName = parts[3]?.toUpperCase() || 'PRO';
      await this.activateSubscriptionMock(userId, planName);
    } else if (sessionId.startsWith('mock_session_credits_')) {
      const parts = sessionId.split('_');
      const amount = parseInt(parts[3], 10) || 1000;
      await this.billingService.addCredits(userId, amount, 'PURCHASE', 'Simulated Credit Refill');
    }
  }

  private async activateSubscriptionMock(userId: string, planName: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { name: planName } });
    if (!plan) return;

    const endPeriod = new Date();
    endPeriod.setMonth(endPeriod.getMonth() + 1);

    await this.billingService.createOrUpdateSubscription(userId, planName, 'ACTIVE', endPeriod);
    
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) return;

      await tx.user.update({
        where: { id: userId },
        data: {
          credits: user.credits + plan.credits,
          monthlyCredits: plan.credits,
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount: plan.credits,
          type: 'PURCHASE',
          description: `Simulated plan activation: ${planName}`,
        },
      });

      await tx.billingEvent.create({
        data: {
          userId,
          eventType: 'SUBSCRIPTION_CREATED',
          metadata: JSON.stringify({ planName, simulated: true }),
        },
      });
    });
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    if (this.isSimulationMode()) return;
    
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('Stripe Webhook Secret not configured');

    const event = this.stripe!.webhooks.constructEvent(rawBody, signature, secret);
    this.logger.log(`Received Stripe Webhook Event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.client_reference_id;
        if (!userId) break;

        const customerId = session.customer as string;
        
        if (session.metadata?.type === 'credits') {
          const creditsAmount = parseInt(session.metadata.amount || '0', 10);
          await this.billingService.addCredits(userId, creditsAmount, 'PURCHASE', 'Stripe Credit Purchase');
          
          await this.prisma.payment.create({
            data: {
              userId,
              stripeSessionId: session.id,
              amount: (session.amount_total || 0) / 100,
              currency: session.currency || 'usd',
              status: 'COMPLETED',
              paymentMethod: 'card',
              description: `Purchased ${creditsAmount} Credits`,
            },
          });
        } else if (session.mode === 'subscription') {
          const planName = session.metadata?.planName || 'FREE';
          const subscriptionId = session.subscription as string;
          
          const plan = await this.prisma.subscriptionPlan.findUnique({ where: { name: planName } });
          if (!plan) break;

          const endPeriod = new Date();
          endPeriod.setMonth(endPeriod.getMonth() + 1);

          await this.billingService.createOrUpdateSubscription(userId, planName, 'ACTIVE', endPeriod);
          
          await this.prisma.subscription.update({
            where: { userId },
            data: {
              stripeSubscriptionId: subscriptionId,
              stripeCustomerId: customerId,
            },
          });

          await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({ where: { id: userId } });
            if (user) {
              await tx.user.update({
                where: { id: userId },
                data: {
                  credits: user.credits + plan.credits,
                  monthlyCredits: plan.credits,
                },
              });
            }
          });

          await this.prisma.billingEvent.create({
            data: {
              userId,
              eventType: 'SUBSCRIPTION_CREATED',
              metadata: JSON.stringify({ planName, stripeSubscriptionId: subscriptionId }),
            },
          });
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) break;

        const sub = await this.prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
        });
        if (!sub) break;

        const planName = sub.plan;
        const plan = await this.prisma.subscriptionPlan.findUnique({ where: { name: planName } });
        if (!plan) break;

        const endPeriod = new Date();
        endPeriod.setMonth(endPeriod.getMonth() + 1);

        await this.prisma.subscription.update({
          where: { userId: sub.userId },
          data: { currentPeriodEnd: endPeriod, status: 'ACTIVE' },
        });

        await this.billingService.addCredits(sub.userId, plan.credits, 'PURCHASE', `Monthly subscription renewal: ${planName}`);
        
        await this.prisma.invoice.create({
          data: {
            userId: sub.userId,
            invoiceNumber: invoice.number || `INV-${Date.now()}`,
            amount: (invoice.amount_paid || 0) / 100,
            status: 'PAID',
            pdfUrl: invoice.hosted_invoice_url,
            paymentDate: new Date(),
          },
        });
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) break;

        const sub = await this.prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
        });
        if (!sub) break;

        await this.prisma.subscription.update({
          where: { userId: sub.userId },
          data: { status: 'PAST_DUE' },
        });

        await this.prisma.billingEvent.create({
          data: {
            userId: sub.userId,
            eventType: 'PAYMENT_FAILED',
            metadata: JSON.stringify({ invoiceId: invoice.id }),
          },
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        
        const sub = await this.prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (!sub) break;

        await this.prisma.subscription.update({
          where: { userId: sub.userId },
          data: { plan: 'FREE', status: 'ACTIVE' },
        });

        await this.prisma.billingEvent.create({
          data: {
            userId: sub.userId,
            eventType: 'SUBSCRIPTION_CANCELLED',
            metadata: JSON.stringify({ stripeSubscriptionId: subscription.id }),
          },
        });
        break;
      }
    }
  }
}
