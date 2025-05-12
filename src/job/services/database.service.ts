import { Injectable, NotFoundException } from '@nestjs/common';
import { Connection, Model, Document, Schema } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';

@Injectable()
export class DatabaseService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async collectionExists(collectionName: string): Promise<boolean> {
    try {
      if (!this.connection.db) {
        throw new Error('Database connection not established');
      }
      const collections = await this.connection.db.listCollections().toArray();
      return collections.some(col => col.name === collectionName);
    } catch (error) {
      throw new NotFoundException(`Error checking collection existence: ${error.message}`);
    }
  }

  async getModel(collectionName: string): Promise<Model<any>> {
    try {
      // First check if collection exists
      const exists = await this.collectionExists(collectionName);
      if (!exists) {
        throw new NotFoundException(`Collection ${collectionName} does not exist in database`);
      }

      if (this.connection.models[collectionName]) {
        return this.connection.models[collectionName];
      }

      const schema = new Schema({}, { 
        strict: false,
        versionKey: false
      });
      
      return this.connection.model(collectionName, schema);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`Error accessing collection ${collectionName}: ${error.message}`);
    }
  }

  async findInCollection(collectionName: string, query: any): Promise<any[]> {
    const model = await this.getModel(collectionName);
    try {
      return await model.find(query).lean().exec();
    } catch (error) {
      throw new NotFoundException(`Error querying collection ${collectionName}`);
    }
  }
}
