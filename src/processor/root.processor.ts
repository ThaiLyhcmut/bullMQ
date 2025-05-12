import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ModuleRef } from '@nestjs/core';

@Processor('*') // hoặc cụ thể 1 queue nếu bạn muốn
export class AppProcessor extends WorkerHost {
  private readonly logger = new Logger(AppProcessor.name);

  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Định tuyến job ${job.id} (${job.name})`);

    try {
      const [serviceName, methodName] = job.name.split('.');
      if (!serviceName || !methodName) {
        throw new Error(`Tên job không hợp lệ: ${job.name}`);
      }

      console.log(serviceName, methodName)
      // Tìm service trong DI Container
      const service = this.moduleRef.get(serviceName, { strict: false });
      console.log(service)
      if (!service || typeof service[methodName] !== 'function') {
        throw new Error(`Không tìm thấy ${methodName} trong ${serviceName}`);
      }

      // Gọi phương thức xử lý
      return await service[methodName](job);
    } catch (error) {
      this.logger.error(`Lỗi xử lý job ${job.name}: ${error.message}`);
      throw error;
    }
  }
}
