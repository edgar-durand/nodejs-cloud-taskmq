import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MulterModule } from '@nestjs/platform-express';

// Configuration
import cloudTaskMQConfig from './config/cloudtaskmq.config';

// Core modules
import { CloudTaskMQModule } from './cloudtaskmq/cloudtaskmq.module';
import { ProcessorsModule } from './processors/processors.module';

// Controllers
import { AppController } from './app.controller';
import { TasksController } from './controllers/tasks.controller';
// import { UploadController } from './controllers/upload.controller';
// import { QueuesController } from './controllers/queues.controller';
// import { ProcessorsController } from './controllers/processors.controller';
// import { DashboardController } from './controllers/dashboard.controller';

// Services
import { AppService } from './app.service';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [cloudTaskMQConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    
    // Scheduling
    ScheduleModule.forRoot(),
    
    // File upload
    MulterModule.register({
      dest: './uploads',
    }),
    
    // CloudTaskMQ
    CloudTaskMQModule,
    
    // Processors
    ProcessorsModule,
  ],
  controllers: [
    AppController,
    TasksController,
    // UploadController,
    // QueuesController,
    // ProcessorsController,
    // DashboardController,
  ],
  providers: [AppService],
})
export class AppModule {}
