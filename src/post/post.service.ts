
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);


  async LatestJob(data: any) {
    // Xử lý nhanh
    this.logger.log(`Đã hoàn thành LATEST job:`);
    return { status: 'success', type: 'LATEST' };
  }
  async ActiveJob(data: any) {
    // Xử lý lâu để job ở trạng thái ACTIVE một thời gian
    // Giả lập xử lý lâu

    return { status: 'success', type: 'ACTIVE' };
  }
  async WaitingJob(data: any) {
    // Xử lý trung bình
    this.logger.log(`Đã hoàn thành WAITING job:`);
    return { status: 'success', type: 'WAITING' };
  }
  async ParentJob(data: any) {
    this.logger.log(`Job này phải đợi ${data.childJobs} child jobs hoàn thành`);

    // Job này sẽ tự động đợi các child jobs hoàn thành trước khi được xử lý
    // nhờ vào việc gọi job.moveToWaitingChildren() trong JobsService

    await new Promise(resolve => setTimeout(resolve, 2000));
    this.logger.log(`Đã hoàn thành PARENT job:`);
    return { status: 'success', type: 'PARENT' };
  }
  async ChildJob(data: any) {
    return { status: 'success', type: 'CHILD' };
  }
  async PriorityJob(data: any) {
    // Xử lý nhanh vì đây là job ưu tiên
    this.logger.log(`Đã hoàn thành PRIORITIZED job:`);
    return { status: 'success', type: 'PRIORITIZED' };
  }
  async processCompletedJob(data: any) {
    // Xử lý nhanh
    this.logger.log(`Đã hoàn thành COMPLETED job:`);
    return { status: 'success', type: 'COMPLETED' };
  }
  async FailedJob(data: any) {

    if (data.shouldFail) {
      this.logger.error(`Cố tình gây lỗi cho job:`);
      throw new Error('Job này được cấu hình để thất bại');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    this.logger.log(`Đã hoàn thành FAILED job:`);
    return { status: 'success', type: 'FAILED' };
  }
  async DelayedJob(data: any) {
    // Xử lý nhanh
    this.logger.log(`Đã hoàn thành DELAYED job:`);
    return { status: 'success', type: 'DELAYED' };
  }
  async PausedQueueJob(data: any) {
    // Xử lý nhanh
    this.logger.log(`Đã hoàn thành job từ PAUSED queue:`);
    return { status: 'success', type: 'PAUSED' };
  }

}