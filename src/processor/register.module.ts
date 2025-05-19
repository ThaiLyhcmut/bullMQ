import { Module } from '@nestjs/common';
import { BullModule, Processor, WorkerHost } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Logger } from '@nestjs/common';
import { Job, Queue, QueueEvents } from 'bullmq';
import { ModuleRef } from '@nestjs/core';
import { JobsModule } from 'src/job/job.module';
import { MailService } from 'src/mail/mail.service';
import { PostService } from 'src/post/post.service';
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';
import { JobsService } from 'src/job/services/job.service';
import { PostModule } from 'src/post/post.module';
import { MailModule } from 'src/mail/mail.module';

// Factory function to create a processor class for a specific queue
const createProcessorClass = (queueName: string) => {
  @Processor(queueName)
  class GenericProcessor extends WorkerHost {
    private readonly logger = new Logger(`${GenericProcessor.name}-${queueName}`);

    constructor(private readonly moduleRef: ModuleRef) {
      super();
    }
    async process(job: Job): Promise<any> {
      this.logger.log(`Xử lý job từ queue ${queueName}: ${job.id} (${job.name})`);
      if (job.data.type == "WATTING_CHILDREN" ) {
        job.isWaitingChildren()
      }
      if (job.data.codition != "") {
        
      }
      try {
        const [serviceName, methodName] = job.name.split('.');
        if (!serviceName || !methodName) {
          throw new Error(`Tên job không hợp lệ: ${job.name}`);
        }

        const JobsOptions = job.opts as any;

        // Kiểm tra và đợi job phụ thuộc nếu có
        if (JobsOptions.processDependenciesResults && JobsOptions.dependencies?.length > 0 && job.data.queueNamePrev) {
          try {
            const parentQueueName = job.data.queueNamePrev;
            // Lấy queue của job phụ thuộc
            const parentQueue = this.moduleRef.get(`BullQueue_${parentQueueName}`, { strict: false }) as Queue;
            const parentQueueEvent: QueueEvents = new QueueEvents(parentQueueName)
            if (!parentQueue) {
              throw new Error(`Không tìm thấy queue ${parentQueueName}`);
            }
            const jobId = JobsOptions.dependencies[0];
            this.logger.log(`Đang đợi job phụ thuộc ${jobId} từ queue ${parentQueueName}`);
            const prevJob:Job = await parentQueue.getJob(jobId);
            const result = await prevJob.waitUntilFinished(parentQueueEvent)
            this.logger.log(`Job phụ thuộc ${jobId} hoàn thành với kết quả: ${JSON.stringify(result)}`);
            console.log(result)
            result['bullMQjobID_1'] = job.id
            // Gộp kết quả job phụ thuộc vào job.data nếu cần
            job.data.previousResult = result;
            
            // Đóng QueueEvents để tránh rò rỉ tài nguyên
            // await parentQueue.close();
          } catch (err) {
            this.logger.warn(`Không thể lấy kết quả từ job phụ thuộc: ${err.message}`);
            throw err; // Hoặc xử lý lỗi theo cách bạn muốn
          }
        }

        const service = this.moduleRef.get(serviceName, { strict: false });
        this.logger.log(`Thực thi ${serviceName}.${methodName} với data: ${JSON.stringify(job.data)}`);
        if (!service || typeof service[methodName] !== 'function') {
          throw new Error(`Không tìm thấy ${methodName} trong ${serviceName}`);
        }

        try {
          return await service[methodName](job.data);
        } catch (err) {
          throw new Error(`Lỗi khi gọi ${serviceName}.${methodName} với data ${JSON.stringify(job.data)}: ${err.message}`);
        }
      } catch (error) {
        this.logger.error(`Lỗi xử lý job ${job.name}: ${error.message}`);
        throw error;
      }
    }
  }

  return GenericProcessor;
};

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'posts' },
      { name: 'database' }
    ),
    BullBoardModule.forFeature(
      { name: 'email', adapter: BullMQAdapter },
      { name: 'posts', adapter: BullMQAdapter },
      { name: 'database', adapter: BullMQAdapter }
    ),
    JobsModule,
    DatabaseModule,
    PostModule,
    MailModule
  ],
  providers: [
    // Register processors dynamically
    {
      provide: 'EMAIL_PROCESSOR',
      useClass: createProcessorClass('email'),
    },
    {
      provide: 'POSTS_PROCESSOR',
      useClass: createProcessorClass('posts'),
    },
    {
      provide: 'DATABASE_PROCESSOR',
      useClass: createProcessorClass('database'),
    },
    // Provide services
    { provide: 'MailService', useExisting: MailService },
    { provide: 'PostService', useExisting: PostService },
    { provide: 'DatabaseService', useExisting: DatabaseService },
    { provide: 'JobsService', useExisting: JobsService }
  ],
  exports: [BullModule],
})
export class RegisterServiceModule {}