// src/job/services/database.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Db, Collection } from 'mongodb';
import { Job } from 'bullmq';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private db: Db;
  private collections: Map<string, Collection> = new Map();

  constructor(@InjectConnection() private readonly connection: Connection) {
    // Lấy native connection từ mongoose
    const client = this.connection.getClient();
    this.db = client.db();
    console.log("CREATE DATABASE")
  }

  async onModuleInit() {
    // Danh sách các queue cần khởi tạo collection
    const queueNames = ['email', 'posts'];

    for (const name of queueNames) {
      await this.getOrCreateCollection(name);
    }

    this.logger.log('Đã khởi tạo tất cả collections cho DatabaseService');
  }

  private async getOrCreateCollection(name: string): Promise<Collection> {
    if (this.collections.has(name)) {
      return this.collections.get(name) as any;
    }

    try {
      // Kiểm tra collection đã tồn tại chưa
      const collections = await this.db.listCollections({ name }).toArray();

      if (collections.length === 0) {
        await this.db.createCollection(name);
        this.logger.log(`Đã tạo collection mới: ${name}`);
      }

      const collection = this.db.collection(name);

      this.collections.set(name, collection);
      this.logger.log(`Đã khởi tạo collection: ${name}`);
      return collection;
    } catch (error) {
      this.logger.error(`Lỗi khi khởi tạo collection ${name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute a raw MongoDB query on a specified collection
   */
  async executeQuery(
    data: any
  ): Promise<any> {
    const {
      collectionName,
      query,
      operation = 'find'
    }: {
      collectionName: string,
      query: Record<string, any> | Record<string, any>[] | undefined,
      operation: 'find' | 'insert' | 'update' | 'delete' | 'lookup'
    } = data
    try {
      console.log(data.previousResult)
      // Validate collection name
      if (!/^[a-zA-Z0-9_]+$/.test(collectionName)) {
        this.logger.warn(`Invalid collection name: ${collectionName}`);
        throw new Error('Invalid collection name');
      }

      // Lấy hoặc tạo collection nếu chưa có
      const collection = await this.getOrCreateCollection(collectionName);
      this.logger.log(
        `Executing ${operation} query on collection ${collectionName}: ${JSON.stringify(query)}`,
      );

      let result: any;

      // Execute the query based on operation type
      switch (operation) {
        case 'find':
          result = await collection.find(query as Record<string, any>).toArray();
          this.logger.log(`Find query returned ${result.length} results`);
          break;
        case 'insert':
          // Nếu có previousResult thì ưu tiên dùng previousResult
          const insertData = data.previousResult ?? (Array.isArray(query) ? query : [query]);

          if (Array.isArray(insertData)) {
            result = await collection.insertMany(insertData);
            this.logger.log(`Inserted ${result.insertedCount} document(s)`);
          } else {
            result = await collection.insertOne(insertData);
            this.logger.log(`Inserted 1 document`);
          }
          break
        case 'update':
          result = await collection.updateMany(
            (query as Record<string, any>).filter || {},
            (query as Record<string, any>).update || query,
          );
          this.logger.log(`Updated ${result.modifiedCount} document(s)`);
          break;
        case 'delete':
          result = await collection.deleteMany(query as Record<string, any>);
          this.logger.log(`Deleted ${result.deletedCount} document(s)`);
          break;
        case 'lookup':
          // Handle lookup as an aggregation pipeline
          const pipeline = Array.isArray(query) ? query : [query];
          result = await collection.aggregate(pipeline).toArray();
          this.logger.log(`Lookup query returned ${result.length} results`);
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Query execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute a raw MongoDB aggregation pipeline
   */
  async executeAggregation(data: any): Promise<any[]> {
    console.log("dataaaaaaaaa", data)
    const {
      collectionName, pipeline
    }: { collectionName: string, pipeline: Record<string, any>[] } = data
    console.log("ccccccccc",collectionName, pipeline)
    try {
      // Validate collection name
      if (!/^[a-zA-Z0-9_]+$/.test(collectionName)) {
        this.logger.warn(`Invalid collection name: ${collectionName}`);
        throw new Error('Invalid collection name');
      }

      // Lấy hoặc tạo collection
      const collection = await this.getOrCreateCollection(collectionName);

      this.logger.log(
        `Executing aggregation on collection ${collectionName}: ${JSON.stringify(pipeline)}`,
      );

      // Execute the aggregation pipeline
      const results = await collection.aggregate(pipeline).toArray();
      this.logger.log(`Aggregation returned ${results.length} results`);
      return results;
    } catch (error) {
      this.logger.error(`Aggregation execution failed: ${error.message}`);
      throw error;
    }
  }
}