
import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  /**
   * Execute a raw MongoDB query on a specified collection
   * @param collectionName The name of the collection to query
   * @param query The MongoDB query object (e.g., { "age": { "$gt": 18 } })
   * @param options Optional query options (e.g., sort, limit, skip)
   * @returns Query results
   */
  async executeQuery(
    collectionName: string,
    query: Record<string, any>,
    options: { sort?: Record<string, any>; limit?: number; skip?: number } = {},
  ): Promise<any[]> {
    try {
      // Validate collection name to prevent injection
      if (!/^[a-zA-Z0-9_]+$/.test(collectionName)) {
        this.logger.warn(`Invalid collection name: ${collectionName}`);
        throw new BadRequestException('Invalid collection name');
      }

      // Restrict to read-only operations (find) to prevent destructive actions
      // You can extend this to allow updates/deletes with proper authorization
      if (this.isWriteOperation(query)) {
        this.logger.warn(`Write operations are not allowed: ${JSON.stringify(query)}`);
        throw new ForbiddenException('Write operations are not permitted');
      }

      this.logger.log(
        `Executing query on collection ${collectionName}: ${JSON.stringify(query)} with options ${JSON.stringify(options)}`,
      );

      // Access the collection
      const collection = this.connection.collection(collectionName);

      // Build the query
      let queryBuilder = collection.find(query);

      // Apply options (sort, limit, skip)
      if (options.sort) {
        queryBuilder = queryBuilder.sort(options.sort);
      }
      if (options.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
      }
      if (options.skip) {
        queryBuilder = queryBuilder.skip(options.skip);
      }

      // Execute the query and convert to array
      const results = await queryBuilder.toArray();

      this.logger.log(`Query returned ${results.length} results`);
      return results;
    } catch (error) {
      this.logger.error(`Query execution failed: ${error.message}`);
      throw new BadRequestException(`Query execution failed: ${error.message}`);
    }
  }

  /**
   * Execute a raw MongoDB aggregation pipeline
   * @param collectionName The name of the collection
   * @param pipeline The aggregation pipeline (e.g., [{ $match: { age: { $gt: 18 } } }])
   * @returns Aggregation results
   */
  async executeAggregation(collectionName: string, pipeline: Record<string, any>[]): Promise<any[]> {
    try {
      // Validate collection name
      if (!/^[a-zA-Z0-9_]+$/.test(collectionName)) {
        this.logger.warn(`Invalid collection name: ${collectionName}`);
        throw new BadRequestException('Invalid collection name');
      }

      this.logger.log(
        `Executing aggregation on collection ${collectionName}: ${JSON.stringify(pipeline)}`,
      );

      // Access the collection
      const collection = this.connection.collection(collectionName);

      // Execute the aggregation pipeline
      const results = await collection.aggregate(pipeline).toArray();

      this.logger.log(`Aggregation returned ${results.length} results`);
      return results;
    } catch (error) {
      this.logger.error(`Aggregation execution failed: ${error.message}`);
      throw new BadRequestException(`Aggregation execution failed: ${error.message}`);
    }
  }

  /**
   * Check if the query contains write operations (e.g., update, delete)
   * @param query The query object
   * @returns True if the query is a write operation
   */
  private isWriteOperation(query: Record<string, any>): boolean {
    // Add more checks as needed for specific write operations
    const writeOperators = ['$set', '$unset', '$inc', '$push', '$pull'];
    return Object.keys(query).some((key) => writeOperators.includes(key));
  }
}