import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { createHash } from 'crypto';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly keyDelimiter = ':';

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    this.client.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis server');
    });
  }

  /**
   * Build a Redis key from URL path and hashed frontend data
   * @param urlPath The URL path (e.g., 'api/order')
   * @param data Optional frontend data to hash (e.g., req.body or req.query)
   * @returns Key in format urlPath:hash(data) or urlPath if no data
   */
  buildKeyWithHash(urlPath: string, data?: object): string {
    try {
      if (!urlPath || typeof urlPath !== 'string' || urlPath.trim() === '') {
        this.logger.warn('Invalid URL path provided');
        throw new BadRequestException('URL path must be a non-empty string');
      }

      // Convert URL path to folder structure (e.g., 'api/order' -> 'api:order')
      const folders = urlPath
        .replace(/^\//, '') // Remove leading slash
        .split('/')
        .filter(segment => segment.trim() !== '');

      if (folders.length === 0) {
        this.logger.warn('Invalid URL path: no valid segments');
        throw new BadRequestException('URL path must contain valid segments');
      }

      // If no data provided, return key without hash
      if (!data || Object.keys(data).length === 0) {
        return folders.join(this.keyDelimiter);
      }

      // Sort keys to ensure consistent JSON string
      const sortObject = (obj: any): any => {
        if (typeof obj !== 'object' || obj === null) {
          return obj;
        }
        if (Array.isArray(obj)) {
          return obj.map(sortObject);
        }
        return Object.keys(obj)
          .sort()
          .reduce((acc, key) => {
            acc[key] = sortObject(obj[key]);
            return acc;
          }, {});
      };

      // Hash the sorted data using SHA256
      const sortedData = sortObject(data);
      const dataString = JSON.stringify(sortedData);
      const hash = createHash('sha256').update(dataString).digest('hex');
      
      // Combine folders and hash
      const key = [...folders, hash].join(this.keyDelimiter);
      this.logger.log(`Built key: ${key}`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to build key for path ${urlPath}: ${error.message}`);
      throw new BadRequestException(`Failed to build key: ${error.message}`);
    }
  }

  async executeLuaScript(script: string, keys: string[] = [], args: (string | number)[] = []): Promise<any> {
    try {
      if (!script || typeof script !== 'string' || script.trim() === '') {
        this.logger.warn('Invalid Lua script provided');
        throw new BadRequestException('Lua script must be a non-empty string');
      }
      if (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string')) {
        this.logger.warn('Invalid keys provided');
        throw new BadRequestException('Keys must be an array of strings');
      }
      if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string' && typeof arg !== 'number')) {
        this.logger.warn('Invalid arguments provided');
        throw new BadRequestException('Arguments must be an array of strings or numbers');
      }
      this.logger.log(`Executing Lua script with ${keys.length} keys and ${args.length} arguments`);
      const result = await this.client.eval(script, keys.length, ...keys, ...args);
      this.logger.log('Lua script executed successfully');
      return result;
    } catch (error) {
      this.logger.error(`Failed to execute Lua script: ${error.message}`);
      throw new BadRequestException(`Lua script execution failed: ${error.message}`);
    }
  }

  async set(key: string, value: string | number | Buffer, expiry?: number): Promise<string> {
    try {
      if (!key || typeof key !== 'string') {
        this.logger.warn('Invalid key provided');
        throw new BadRequestException('Key must be a non-empty string');
      }
      const result = expiry
        ? await this.client.set(key, value, 'EX', expiry)
        : await this.client.set(key, value);
      this.logger.log(`Set key ${key} successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to set key ${key}: ${error.message}`);
      throw new BadRequestException(`Failed to set key: ${error.message}`);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (!key || typeof key !== 'string') {
        this.logger.warn('Invalid key provided');
        throw new BadRequestException('Key must be a non-empty string');
      }
      const value = await this.client.get(key);
      this.logger.log(`Retrieved value for key ${key}`);
      return value;
    } catch (error) {
      this.logger.error(`Failed to get key ${key}: ${error.message}`);
      throw new BadRequestException(`Failed to get key: ${error.message}`);
    }
  }

  async update(key: string, value: string | number | Buffer, expiry?: number): Promise<string> {
    try {
      if (!key || typeof key !== 'string') {
        this.logger.warn('Invalid key provided');
        throw new BadRequestException('Key must be a non-empty string');
      }
      const exists = await this.client.exists(key);
      if (!exists) {
        this.logger.warn(`Key ${key} does not exist`);
        throw new BadRequestException(`Key ${key} does not exist`);
      }
      const result = expiry
        ? await this.client.set(key, value, 'EX', expiry)
        : await this.client.set(key, value);
      this.logger.log(`Updated key ${key} successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to update key ${key}: ${error.message}`);
      throw new BadRequestException(`Failed to update key: ${error.message}`);
    }
  }

  async delete(key: string): Promise<number> {
    try {
      if (!key || typeof key !== 'string') {
        this.logger.warn('Invalid key provided');
        throw new BadRequestException('Key must be a non-empty string');
      }
      const result = await this.client.del(key);
      this.logger.log(`Deleted key ${key} successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}: ${error.message}`);
      throw new BadRequestException(`Failed to delete key: ${error.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!key || typeof key !== 'string') {
        this.logger.warn('Invalid key provided');
        throw new BadRequestException('Key must be a non-empty string');
      }
      const result = await this.client.exists(key);
      this.logger.log(`Checked existence of key ${key}`);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check existence of key ${key}: ${error.message}`);
      throw new BadRequestException(`Failed to check key existence: ${error.message}`);
    }
  }

  async setExpiry(key: string, seconds: number): Promise<number> {
    try {
      if (!key || typeof key !== 'string') {
        this.logger.warn('Invalid key provided');
        throw new BadRequestException('Key must be a non-empty string');
      }
      if (typeof seconds !== 'number' || seconds <= 0) {
        this.logger.warn('Invalid expiry time provided');
        throw new BadRequestException('Expiry time must be a positive number');
      }
      const result = await this.client.expire(key, seconds);
      this.logger.log(`Set expiry for key ${key} to ${seconds} seconds`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to set expiry for key ${key}: ${error.message}`);
      throw new BadRequestException(`Failed to set expiry: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log('Disconnected from Redis server');
    } catch (error) {
      this.logger.error(`Failed to disconnect from Redis: ${error.message}`);
      throw error;
    }
  }
}