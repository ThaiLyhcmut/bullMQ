// processor.module.ts
import { Module } from '@nestjs/common';
import { BullModule, Processor, WorkerHost } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ModuleRef } from '@nestjs/core';
import { JobsModule } from 'src/job/job.module';
import { MailService } from 'src/mail/mail.service';
import { PostService } from 'src/post/post.service';

// Factory function to create a processor class for a specific queue
const createProcessorClass = (queueName: string) => {
  @Processor(queueName)
  class GenericProcessor extends WorkerHost {
    private readonly logger = new Logger(`${GenericProcessor.name}-${queueName}`);

    constructor(private readonly moduleRef: ModuleRef) {
      super();
    }

    // Trong GenericProcessor
    async process(job: Job): Promise<any> {
      this.logger.log(`Xử lý job từ queue ${queueName}: ${job.id} (${job.name})`);
      try {
        const [serviceName, methodName] = job.name.split('.');
        if (!serviceName || !methodName) {
          throw new Error(`Tên job không hợp lệ: ${job.name}`);
        }
        const JobsOptions = job.opts as any
        // Xử lý kết quả từ job trước nếu có
        if (job.data.previousJobId && JobsOptions.processDependenciesResults) {
          try {
            
            // Lấy queue để truy cập job trước đó
            const queue = this.moduleRef.get(`BullQueue_${job.data.queueNameParant}`, { strict: false });

            if (queue) {
              // Lấy job trước đó
              
              const previousJob = await queue.getJob(job.data.previousJobId);

              if (previousJob) {
                // Kiểm tra trạng thái
                const state = await previousJob.getState();

                if (state === 'completed') {
                  this.logger.log(`Nhận được kết quả từ job trước (${job.data.previousJobId})`);
                  // Lưu kết quả vào job.data
                  job.data.previousResult = previousJob.returnvalue;
                  console.log(`Kết quả từ job trước:`, previousJob.returnvalue);
                } else {
                  this.logger.warn(`Job trước (${job.data.previousJobId}) chưa hoàn thành, trạng thái: ${state}`);
                }
              } else {
                this.logger.warn(`Không tìm thấy job trước với ID: ${job.data.previousJobId}`);
              }
            }
          } catch (err) {
            this.logger.warn(`Không thể lấy kết quả từ job trước: ${err.message}`);
          }
        }

        const service = this.moduleRef.get(serviceName, { strict: false });
        if (!service || typeof service[methodName] !== 'function') {
          throw new Error(`Không tìm thấy ${methodName} trong ${serviceName}`);
        }

        return await service[methodName](job);
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
    ),
    BullBoardModule.forFeature(
      { name: 'email', adapter: BullMQAdapter },
      { name: 'posts', adapter: BullMQAdapter },
    ),
    JobsModule,
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
    // Provide MailService and PostService
    { provide: 'MailService', useClass: MailService },
    { provide: 'PostService', useClass: PostService },
  ],
  exports: [BullModule],
})
export class ProcessorModule { }