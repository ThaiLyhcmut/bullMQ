import { CacheModule } from '@nestjs/cache-manager';
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Redis from 'ioredis';
import { redisStore } from 'cache-manager-redis-yet';
import { RedisCacheMiddleware } from './middleware/redis.middleware.service';
import { RedisCacheInterceptor } from './interceptor/redis.interceptor.service';

@Global()
@Module({
  imports:[
    
  ],
  providers: [
    
  ],
  exports: [],
})
export class RedisModule {}
