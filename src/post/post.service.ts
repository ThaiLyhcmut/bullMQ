
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);


  async LatestJob() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.logger.log(`Đã hoàn thành LATEST job:`);
    return { status: 'success', type: 'LATEST' };
  }
  async ActiveJob(processingTime: any) {
    // Xử lý lâu để job ở trạng thái ACTIVE một thời gian
    const time = processingTime || 60000;
    this.logger.log(`Job sẽ hoạt động trong ${time}ms`);

    // Giả lập xử lý lâu
    await new Promise(resolve => setTimeout(resolve, processingTime));

    return { status: 'success', type: 'ACTIVE' };
  }
  async WaitingJob() {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { status: 'success', type: 'WAITING' };
  }
  async ParentJob(type: string, childJobs: string) {
    
    if (type === 'WAITING_CHILDREN') {
      this.logger.log(`Đang xử lý PARENT job`);
      this.logger.log(`Job này phải đợi ${childJobs} child jobs hoàn thành`);
      return { status: 'watting', type: 'WAITING_CHILDREN' };
    }
    return { status: 'success', type: 'WAITING_CHILDREN' };
  }
  async PriorityJob() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { status: 'success', type: 'PRIORITIZED' };
  }
  async processCompletedJob() {
    // Xử lý nhanh
    await new Promise(resolve => setTimeout(resolve, 500));
    return { status: 'success', type: 'COMPLETED' };
  }
  async FailedJob(shouldFail: boolean) {

    if (shouldFail) {
      this.logger.error(`Cố tình gây lỗi cho job`);
      throw new Error('Job này được cấu hình để thất bại');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    return { status: 'success', type: 'FAILED' };
  }
  async DelayedJob() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { status: 'success', type: 'DELAYED' };
  }
  async PausedQueueJob() {
    // Xử lý nhanh
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { status: 'success', type: 'PAUSED' };
  }

}