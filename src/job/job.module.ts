// Tạo file src/jobs/jobs.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { JobsService } from './services/job.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseService } from './services/database.service';
import { QueueAdapter } from './services/queue.service';
import { RedisModule } from 'src/redis/redis.module';
// import { ProcessorModule } from 'src/processor/processor.module';
const jobNames = ['posts', 'resize', 'email', 'report'];
const bullQueues = jobNames.map(name => ({
  name,
}));

const bullBoardModules = jobNames.map(name =>
  BullBoardModule.forFeature({
    name,
    adapter: BullMQAdapter,
  }),
);

@Module({
  imports: [
    MongooseModule,
    RedisModule,
  ],
  controllers: [],
  providers: [JobsService, DatabaseService, QueueAdapter],
  exports: [JobsService, QueueAdapter, DatabaseService]
})

export class JobsModule{}

