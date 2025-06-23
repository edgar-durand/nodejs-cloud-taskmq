import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudTaskMQService } from './cloudtaskmq.service';
import cloudTaskMQConfig from '../config/cloudtaskmq.config';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(cloudTaskMQConfig),
  ],
  providers: [CloudTaskMQService],
  exports: [CloudTaskMQService],
})
export class CloudTaskMQModule {}
