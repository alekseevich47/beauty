import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { PiiCryptoService } from './pii-crypto.service';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [PiiCryptoService],
  exports: [PiiCryptoService],
})
export class CryptoModule {}
