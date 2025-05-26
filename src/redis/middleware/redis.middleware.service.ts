import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisCacheMiddleware implements NestMiddleware {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const cacheKey = `${req.method}:${req.originalUrl}:${JSON.stringify({
      requestBody: req.body,
      requestQuery: req.query,
      requestParams: req.params,
      requestMethod: req.method,
      requestIp: req.ip,
    })}`;
    const cachedData = await this.cacheManager.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData as string));
    }
    const originalJson = res.json;
    res.json = (body) => {
      this.cacheManager.set(cacheKey, JSON.stringify(body), 60);
      return originalJson.call(res, body);
    };

    next();
  }
}