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
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';
import { JobsService } from 'src/job/services/job.service';

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
        const database = this.moduleRef.get("database", { strict: false });
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
              } else if(job.data.db_type == "pipeline.after") {
                if (!database && typeof database['executeAggregation'] !== 'function') {
                  throw new Error(`Không tìm thấy database trong collection`);
                }
                try {
                  const results = await database['executeAggregation'](
                    job.data.collection, // Sử dụng tên queue làm tên collection
                    job.data.pipeline // Sử dụng query từ job.data
                  );
                  this.logger.log(`Đã thực hiện pipeline query cho job ${job.id}`);
                  job.data.pipeline = results; // Gán kết quả vào previousResult
                } catch (err) {
                  this.logger.error(`Lỗi khi thực hiện pipeline: ${err.message}`);
                  throw err;
                }
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

        const result = await service[methodName](...job.data);
        // save result on database voi bullMQjobID la jobid data save bao gom job.data timestamp status
        if (job.data.db_type == "pipeline.before" && database && typeof database['executeAggregation'] == 'function' && job.data.collection && job.data.pipeline) {
          const serviceJob = this.moduleRef.get('JobsService', { strict: false })
          if (!serviceJob || typeof serviceJob['addJob'] !== 'function') {
            throw new Error(`Không tìm thấy addJob trong JobsService`);
          }
          const dataJob = {
            queueName: "database",
            name: "database.executeAggregation",
            data: {
              type: "LASTEST",
              collection: job.data.collection,
              pipeline: job.data.pipeline
            },
            options: {
              removeOnComplete: false
            }
          }
          serviceJob['addJob'](dataJob)
        }
        return result
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
    // Provide MailService and PostService
    { provide: 'MailService', useClass: MailService },
    { provide: 'PostService', useClass: PostService },
    { provide: 'database', useClass: DatabaseService },
    { provide: 'JobsService', useClass: JobsService}
  ],
  exports: [BullModule],
})
export class RegisterServiceModule { }