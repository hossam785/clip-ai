import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingPlanService } from './billing-plan.service';
import { StripeService } from './stripe.service';
import { ReferralService } from './referral.service';
import { PromoService } from './promo.service';
import { BillingController } from './billing.controller';

@Module({
  controllers: [BillingController],
  providers: [BillingService, BillingPlanService, StripeService, ReferralService, PromoService],
  exports: [BillingService, BillingPlanService, StripeService, ReferralService, PromoService],
})
export class BillingModule {}
