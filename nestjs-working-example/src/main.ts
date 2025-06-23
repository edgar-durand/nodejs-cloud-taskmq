import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS
  app.enableCors();

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('CloudTaskMQ NestJS Example')
    .setDescription('Production-ready task queue with Google Cloud Tasks integration')
    .setVersion('1.0')
    .addTag('tasks', 'Task management endpoints')
    .addTag('queues', 'Queue management and monitoring')
    .addTag('processors', 'GCP Cloud Tasks processor endpoints')
    .addTag('upload', 'File upload and processing')
    .addTag('dashboard', 'Monitoring and analytics')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log('🚀 CloudTaskMQ NestJS Example API is running!');
  console.log(`📍 Server: http://localhost:${port}`);
  console.log(`📊 Dashboard: http://localhost:${port}/api/dashboard`);
  console.log(`📚 API Docs: http://localhost:${port}/docs`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Storage: ${process.env.STORAGE_ADAPTER || 'memory'}`);
  console.log('🎯 Ready to process tasks!');
}

bootstrap();
