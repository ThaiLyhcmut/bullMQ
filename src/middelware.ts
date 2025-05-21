import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from './redis/redis.service';

@Injectable()
export class RedisCacheMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RedisCacheMiddleware.name);

  constructor(private readonly redisService: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const frontendData = {
      ...req.body,
      ...req.query
    }
    const urlPath = req.originalUrl.replace(/\?.*$/, '');
    const cacheKey = this.redisService.buildKeyWithHash(
      urlPath, 
      Object.keys(frontendData).length ? frontendData : undefined
    );

    try {
      const cachedData = await this.redisService.get(cacheKey);
      if (cachedData) {
        this.logger.log(`Cache hit for key ${cacheKey}`);
        return res.status(200).json(JSON.parse(cachedData));
      }

      // Fix the res.send override
      const originalSend = res.send;
      res.send = function(body: any) {
        const response = originalSend.call(this, body);
        
        // Cache the response asynchronously
        if (typeof body === 'string' && this.statusCode === 200) {
          (async () => {
            try {
              await this.redisService.set(cacheKey, body, 3600);
              this.logger.log(`Cached response for key ${cacheKey}`);
            } catch (error) {
              this.logger.error(`Failed to cache response: ${error.message}`);
            }
          })();
        }

        return response;
      }.bind(res);

      next();
    } catch (error) {
      this.logger.error(`Redis cache error: ${error.message}`);
      next();
    }
  }
}