import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose'; 
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI', 'mongodb://thaily:Th%40i2004@localhost:27017/db?authSource=admin'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [DatabaseService],
  exports: [MongooseModule, DatabaseService],
})
export class DatabaseModule {}

