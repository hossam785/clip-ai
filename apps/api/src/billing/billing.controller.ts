import { Controller, Get, Post, Body, UseGuards, Query, Req, Res, Headers, UnauthorizedException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { ReferralService } from './referral.service';
import { PromoService } from './promo.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('billing')
export class BillingController {
  constructor(
    private billingService: BillingService,
    private stripeService: StripeService,
    private referralService: ReferralService,
    private promoService: PromoService,
  ) {}

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  getBalance(@CurrentUser() user: any) {
    return this.billingService.getBalance(user.id);
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  getTransactions(@CurrentUser() user: any) {
    return this.billingService.getTransactions(user.id);
  }

  @Get('plans')
  getPlans() {
    return this.billingService.getPlans();
  }

  @Post('checkout-subscription')
  @UseGuards(JwtAuthGuard)
  checkoutSubscription(
    @Body() body: { planName: string; interval: 'monthly' | 'yearly' },
    @CurrentUser() user: any,
  ) {
    return this.stripeService.createCheckoutSession(user.id, body.planName, body.interval);
  }

  @Post('checkout-credits')
  @UseGuards(JwtAuthGuard)
  checkoutCredits(
    @Body() body: { amount: number },
    @CurrentUser() user: any,
  ) {
    return this.stripeService.purchaseCreditsSession(user.id, body.amount);
  }

  @Post('customer-portal')
  @UseGuards(JwtAuthGuard)
  customerPortal(@CurrentUser() user: any) {
    return this.stripeService.createPortalSession(user.id);
  }

  @Post('checkout-complete')
  @UseGuards(JwtAuthGuard)
  async checkoutComplete(
    @Body() body: { sessionId: string },
    @CurrentUser() user: any,
  ) {
    await this.stripeService.fulfillSimulationSession(body.sessionId, user.id);
    return { success: true };
  }

  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  async getInvoices(@CurrentUser() user: any) {
    return this.billingService.getTransactions(user.id); // for simplicity let's return transactions as list or query invoices table
  }

  @Post('referral/code')
  @UseGuards(JwtAuthGuard)
  async getReferralCode(@CurrentUser() user: any) {
    const code = await this.referralService.generateReferralCode(user.id);
    return { referralCode: code };
  }

  @Get('referral/list')
  @UseGuards(JwtAuthGuard)
  getReferrals(@CurrentUser() user: any) {
    return this.referralService.getReferrals(user.id);
  }

  @Post('promo/redeem')
  @UseGuards(JwtAuthGuard)
  redeemPromo(
    @Body() body: { code: string },
    @CurrentUser() user: any,
  ) {
    return this.promoService.validateAndRedeem(user.id, body.code);
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: any,
    @Res() res: any,
    @Headers('stripe-signature') signature: string,
  ) {
    let rawBody = req.body;
    if (typeof rawBody !== 'string' && !Buffer.isBuffer(rawBody)) {
      rawBody = Buffer.from(JSON.stringify(rawBody));
    }
    
    try {
      await this.stripeService.handleWebhook(rawBody, signature);
      return res.status(200).send({ received: true });
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
}
