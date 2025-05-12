import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Service quản lý cache cho filter
 */
@Injectable()
export class FilterCacheService {
  private readonly logger = new Logger(FilterCacheService.name);
  private readonly cacheTTL: number;

  // Cấu hình TTL (Time-to-Live) theo độ phức tạp của truy vấn
  private readonly TTL = {
    L1: 0,  // 1 hour - Truy vấn đơn giản
    L2: 0,  // 30 minutes - Truy vấn trung bình
    L3: 0,   // 15 minutes - Truy vấn phức tạp
    HOT: 0, // 2 hours - Truy vấn phổ biến
  };

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Inject('REDIS_CLIENT') private redisClient: Redis,
    private readonly configService: ConfigService,
  ) {
    this.cacheTTL = this.configService.get<number>('CACHE_TTL', 3600);
  }

  /**
   * Sinh khóa cache cho một truy vấn filter
   */
  generateCacheKey(collection: string, filterQueryDto: string): string {
    // Tạo chuỗi từ DTO để hash
    const queryString = JSON.stringify(filterQueryDto);
    
    // Tạo MD5 hash từ queryString
    const hash = this.createMd5Hash(queryString);

    // Tạo timestamp theo ngày
    const timestamp = this.getDateString();
    
    // Trường hợp không có join
    return `${collection}:${hash}:${timestamp}`;
  }

  /**
   * Lưu kết quả vào cache
   */
  async cacheResult(key: string, data: any, ttl?: number): Promise<void> {
    try {
      // Xác định TTL dựa vào độ phức tạp của truy vấn
      const cacheTTL = ttl || this.determineTTL(key, data);
      
      await this.cacheManager.set(key, data, cacheTTL * 1000);
      this.logger.debug(`Cached result for ${key} with TTL ${cacheTTL}s`);
    } catch (error) {
      this.logger.error(`Error caching result: ${error.message}`);
    }
  }

  /**
   * Lấy kết quả từ cache
   */
  async getCachedResult<T>(key: string): Promise<T | null> {
    try {
      const cachedData = await this.cacheManager.get<T>(key);
      
      if (cachedData) {
        this.logger.debug(`Cache hit for ${key}`);
        return cachedData;
      }
      
      this.logger.debug(`Cache miss for ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`Error retrieving cached result: ${error.message}`);
      return null;
    }
  }

  /**
   * Xóa cache cho một collection
   */
  async invalidateCache(collection: string): Promise<void> {
    try {
      const pattern = `filter:*${collection}*:*:*`;
      await this.deleteByPattern(pattern);
      this.logger.debug(`Invalidated cache for collection: ${collection}`);
    } catch (error) {
      this.logger.error(`Error invalidating cache: ${error.message}`);
    }
  }

  /**
   * Xóa cache khi một collection thay đổi và các collection phụ thuộc
   */
  async invalidateDependentCaches(collection: string, dependencies: string[] = []): Promise<void> {
    try {
      // Xóa cache cho collection chính
      await this.invalidateCache(collection);
      // Xóa cache cho các collection phụ thuộc
      for (const dep of dependencies) {
        console.log(dep)
        await this.invalidateCache(`${collection}.${dep}`);
      }
      this.logger.debug(`Invalidated cache for collection ${collection} and dependencies: ${dependencies.join(', ')}`);
    } catch (error) {
      this.logger.error(`Error invalidating dependent caches: ${error.message}`);
    }
  }

  /**
   * Xóa cache theo pattern
   * (Phương thức này cần Redis client, giả lập tạm thời)
   */
  private async deleteByPattern(pattern: string): Promise<void> {
    let cursor = '0';
    let deleted = 0;
    console.log(`Pattern: ${pattern}`);  // Log pattern để kiểm tra

    do {
        const [nextCursor, keys] = await this.redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        console.log(`Next cursor: ${nextCursor}, Keys found: ${keys.length}`);
        
        if (keys.length > 0) {
            await this.redisClient.del(...keys);
            deleted += keys.length;
            console.log(`Deleted keys: ${keys}`);  // Log ra các key đã xóa
        }
    } while (cursor !== '0');

    this.logger.debug(`Deleted ${deleted} cache keys matching pattern: ${pattern}`);
}

  

  /**
   * Xác định TTL (Time-To-Live) cho cache dựa vào độ phức tạp của key
   */
  private determineTTL(key: string, data: any): number {
    // Nếu là truy vấn phức tạp (có join)
    if (key.includes('.')) {
      return this.TTL.L2;
    }
    
    // Nếu là truy vấn với nhiều kết quả (nhiều data)
    if (Array.isArray(data) && data.length > 50) {
      return this.TTL.L3;
    }
    
    // Truy vấn đơn giản
    return this.TTL.L1;
  }

  /**
   * Tạo MD5 hash từ chuỗi đầu vào
   */
  private createMd5Hash(input: string): string {
    return createHash('md5').update(input).digest('hex');
  }

  /**
   * Lấy chuỗi ngày hiện tại theo định dạng YYYYMMDD
   */
  private getDateString(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
  }

  /**
   * Trích xuất tên các collection được join từ join string
   */
  private extractJoinedCollections(joinStr: string): string[] {
    const collections: string[] = [];
    
    // Split multiple joins by &
    const joins = joinStr.split('&');
    
    for (const join of joins) {
      // Extract collection name from join string
      const match = join.match(/^([^[\]]+)\[/);
      if (match && match[1]) {
        collections.push(match[1]);
      }
    }
    
    return collections;
  }
}