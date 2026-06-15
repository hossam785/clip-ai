import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
