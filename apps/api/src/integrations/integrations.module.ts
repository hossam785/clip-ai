import { Module, forwardRef } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DeveloperModule } from '../developer/developer.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => DeveloperModule),
  ],
  providers: [IntegrationsService],
  controllers: [IntegrationsController],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
