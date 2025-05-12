// Tạo file src/app.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JobsModule } from './job/job.module';
import { DatabaseModule } from './database/database.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ProcessorModule } from './processor/processor.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    ProcessorModule,
    JobsModule,
    DatabaseModule,
    RedisModule,
    ScheduleModule.forRoot() // Remove schedulerConfig as it's not a valid option
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}