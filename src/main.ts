
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RedisCacheInterceptor } from './redis/interceptor/redis.interceptor.service';
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Thiết lập global prefix  
  // Thiết lập global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,

      exceptionFactory: (errors) => new BadRequestException(errors),
    }),
  );

  // Thiết lập Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Flexible Filter API')
    .setDescription('API for advanced filtering with MongoDB')
    .setVersion('1.0')
    .addTag('filter')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);


  app.useGlobalInterceptors(
    new RedisCacheInterceptor(
      app.get('CACHE_MANAGER'),
      app.get('Reflector')
    )
  );

  await app.listen(3000);
}
bootstrap();