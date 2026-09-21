import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { CentrifugoService } from './centrifugo.service';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [CentrifugoService],
  exports: [CentrifugoService],
})
export class RealtimeModule {}
