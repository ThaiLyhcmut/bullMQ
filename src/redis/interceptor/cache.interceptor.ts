import { SetMetadata } from '@nestjs/common';

export interface CacheConfigOptions {
  key?: string; // Key tùy chỉnh
  ttl?: number; // TTL tùy chỉnh
  noCache?: boolean; // Bỏ qua cache
  type?: string;
}

export const CacheConfig = (config: CacheConfigOptions) =>
  SetMetadata('cacheConfig', config);