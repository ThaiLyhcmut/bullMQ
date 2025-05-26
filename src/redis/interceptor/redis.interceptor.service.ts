import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { CacheConfigOptions } from './cache.interceptor'; 

@Injectable()
export class RedisCacheInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private reflector: Reflector,
  ) {}
  async createCacheKey(context: ExecutionContext): Promise<string> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const cacheConfig = this.reflector.get<CacheConfigOptions>(
      'cacheConfig',
      context.getHandler(),
    );
    const data = {
      requestBody: request.body,
      requestQuery: request.query,
      requestParams: request.params,
      requestMethod: method,
      requestUrl: url,
      requestIp: request.ip,
    };
    const customKey = cacheConfig?.key || `${method}:${url}:${JSON.stringify(data)}`;
    return customKey;
  }
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    const cacheConfig = this.reflector.get<CacheConfigOptions>(
      'cacheConfig',
      context.getHandler(),
    );
    const customKey = await this.createCacheKey(context);
    const ttl = cacheConfig?.ttl || 60; 
    const noCache = cacheConfig?.noCache || false;
    const type = cacheConfig?.type || 'default';
    if (noCache) {
      console.log(`Cache skipped for ${customKey}`);
      return next.handle();
    }
    if (!customKey) {
      console.error('Cache key is required but not provided');
      return next.handle();
    }
    try {
      const cachedData = await this.cacheManager.get(customKey);
      if (cachedData) {
        console.log(`Cache hit for ${customKey}`);
        return of(JSON.parse(cachedData as string));
      }
      return next.handle().pipe(
        tap(async (data) => {
          if (type === 'validate') {
            data['token'] = request.headers['authorization'] || '';
          }
          try {
            await this.cacheManager.set(customKey, JSON.stringify(data), ttl);
            console.log(`Cache set for ${customKey} with TTL ${ttl}s`);
          } catch (error) {
            console.error(`Failed to set cache: ${error.message}`);
          }
        }),
      );
    } catch (error) {
      console.error(`Cache interceptor error: ${error.message}`);
      return next.handle();
    }
  }
}