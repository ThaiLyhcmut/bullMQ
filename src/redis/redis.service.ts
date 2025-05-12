import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor() {
    // Kết nối đến Redis server
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    // Xử lý lỗi kết nối
    this.client.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis server');
    });
  }

  /**
   * Execute a Lua script on Redis
   * @param script The Lua script as a string
   * @param keys Array of Redis keys used in the script
   * @param args Array of arguments passed to the script
   * @returns Result of the Lua script execution
   */
  async executeLuaScript(script: string, keys: string[] = [], args: (string | number)[] = []): Promise<any> {
    try {
      // Validate inputs
      if (!script || typeof script !== 'string' || script.trim() === '') {
        this.logger.warn('Invalid Lua script provided');
        throw new BadRequestException('Lua script must be a non-empty string');
      }

      // Validate keys
      if (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string')) {
        this.logger.warn('Invalid keys provided');
        throw new BadRequestException('Keys must be an array of strings');
      }

      // Validate args
      if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string' && typeof arg !== 'number')) {
        this.logger.warn('Invalid arguments provided');
        throw new BadRequestException('Arguments must be an array of strings or numbers');
      }

      this.logger.log(`Executing Lua script with ${keys.length} keys and ${args.length} arguments`);

      // Execute the Lua script
      const result = await this.client.eval(script, keys.length, ...keys, ...args);

      this.logger.log('Lua script executed successfully');
      return result;
    } catch (error) {
      this.logger.error(`Failed to execute Lua script: ${error.message}`);
      throw new BadRequestException(`Lua script execution failed: ${error.message}`);
    }
  }

  /**
   * Gracefully disconnect from Redis
   */
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