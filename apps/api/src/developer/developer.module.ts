import { Module, forwardRef } from '@nestjs/common';
import { DeveloperService } from './developer.service';
import { DeveloperController } from './developer.controller';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [DeveloperService, WebhookDeliveryService],
  controllers: [DeveloperController],
  exports: [DeveloperService, WebhookDeliveryService],
})
export class DeveloperModule {}
