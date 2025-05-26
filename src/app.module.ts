// Tạo file src/app.module.ts
import { MiddlewareConsumer, Module, NestMiddleware, NestModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { RegisterServiceModule } from './processor/register.module';
import { RedisModule } from './redis/redis.module';
import { RedisCacheMiddleware } from './redis/middleware/redis.middleware.service';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { RedisCacheInterceptor } from './redis/interceptor/redis.interceptor.service';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async () => ({
        store: redisStore,
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10) || 6379,
        ttl: parseInt(process.env.CACHE_TTL || '3600', 10) || 3600,
      }),
    }),
    RegisterServiceModule,
    RedisModule,
    ScheduleModule.forRoot()
  ],
  controllers: [AppController],
  providers: [AppService,
    RedisCacheInterceptor
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RedisCacheMiddleware)
      .forRoutes('*');
  }

}