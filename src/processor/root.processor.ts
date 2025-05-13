import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ModuleRef } from '@nestjs/core';

export class GenericProcessor extends WorkerHost {
  protected readonly logger = new Logger(GenericProcessor.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly queueName: string,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    console.log(`------------------------------- ${this.queueName}`)
    this.logger.log(`Xử lý job từ queue ${this.queueName}: ${job.id} (${job.name})`);
    try {
      const [serviceName, methodName] = job.name.split('.');
      if (!serviceName || !methodName) {
        throw new Error(`Tên job không hợp lệ: ${job.name}`);
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

@Processor('email')
export class MailProcessor extends GenericProcessor {
  constructor(moduleRef: ModuleRef) {
    super(moduleRef, 'email');
  }
}

@Processor('posts')
export class PostProcessor extends GenericProcessor {
  constructor(moduleRef: ModuleRef) {
    super(moduleRef, 'posts');
  }
}