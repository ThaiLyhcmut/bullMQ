import { Processor } from '@nestjs/bullmq';
import { WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Injectable()
@Processor('posts')
export class PostProcessor extends WorkerHost {
  private readonly logger = new Logger(PostProcessor.name);
  async process(job: Job, token?: string): Promise<any> {
    // Add a 10-second delay before processing
    this.logger.log(`Delaying job ${job.id} (${job.name}) for 10 seconds`);
    await new Promise(resolve => setTimeout(resolve, 10000));

    try {
      if (job.name.match(/^child_of_.*/)) {
        return await this.processChildJob(job);
      }
      // Handle named jobs
      switch (job.name) {
        case 'latestJob':
          return await this.processLatestJob(job);
        case 'activeJob':
          return await this.processActiveJob(job);
        case 'waitingJob':
          return await this.processWaitingJob(job);
        case 'parentJob':
          return await this.processParentJob(job);
        case 'priorityJob':
          return await this.processPriorityJob(job);
        case 'completedJob':
          return await this.processCompletedJob(job);
        case 'failedJob':
          return await this.processFailedJob(job);
        case 'delayedJob':
          return await this.processDelayedJob(job);
        case 'pausedQueueJob':
          return await this.processPausedQueueJob(job);
        default:
          this.logger.warn(`Unknown job name: ${job.name}`);
          throw new Error(`No handler for job ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Error processing job ${job.id} (${job.name}): ${error.message}`);
      throw error; // Re-throw to mark job as failed
    }
  }
  async processLatestJob(job: Job) {
    this.logger.log(`Đang xử lý LATEST job: ${job.id}`);
    // Xử lý nhanh
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.logger.log(`Đã hoàn thành LATEST job: ${job.id}`);
    return { status: 'success', type: 'LATEST' };
  }
  async processActiveJob(job: Job) {
    this.logger.log(`Đang xử lý ACTIVE job: ${job.id}`);
    // Xử lý lâu để job ở trạng thái ACTIVE một thời gian
    const processingTime = job.data.processingTime || 60000;
    this.logger.log(`Job ${job.id} sẽ hoạt động trong ${processingTime}ms`);
    
    // Giả lập xử lý lâu
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    this.logger.log(`Đã hoàn thành ACTIVE job: ${job.id}`);
    return { status: 'success', type: 'ACTIVE' };
  }
  async processWaitingJob(job: Job) {
    this.logger.log(`Đang xử lý WAITING job: ${job.id}`);
    // Xử lý trung bình
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.logger.log(`Đã hoàn thành WAITING job: ${job.id}`);
    return { status: 'success', type: 'WAITING' };
  }
  async processParentJob(job: Job) {
    this.logger.log(`Đang xử lý PARENT job: ${job.id}`);
    this.logger.log(`Job này phải đợi ${job.data.childJobs} child jobs hoàn thành`);
    
    // Job này sẽ tự động đợi các child jobs hoàn thành trước khi được xử lý
    // nhờ vào việc gọi job.moveToWaitingChildren() trong JobsService
    
    this.logger.log(`Tất cả child jobs đã hoàn thành, đang xử lý parent job: ${job.id}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.logger.log(`Đã hoàn thành PARENT job: ${job.id}`);
    return { status: 'success', type: 'PARENT' };
  }
  async processChildJob(job: Job) {
    this.logger.log(`Đang xử lý CHILD job: ${job.id} - Index: ${job.data.index}`);
    // Xử lý child jobs với thời gian ngẫu nhiên
    const processingTime = 3000 + Math.random() * 5000;
    await new Promise(resolve => setTimeout(resolve, processingTime));
    this.logger.log(`Đã hoàn thành CHILD job: ${job.id}`);
    return { status: 'success', type: 'CHILD' };
  }
  async processPriorityJob(job: Job) {
    this.logger.log(`Đang xử lý PRIORITIZED job: ${job.id} - Priority: ${job.opts.priority}`);
    // Xử lý nhanh vì đây là job ưu tiên
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.logger.log(`Đã hoàn thành PRIORITIZED job: ${job.id}`);
    return { status: 'success', type: 'PRIORITIZED' };
  }
  async processCompletedJob(job: Job) {
    this.logger.log(`Đang xử lý COMPLETED job: ${job.id}`);
    // Xử lý nhanh
    await new Promise(resolve => setTimeout(resolve, 500));
    this.logger.log(`Đã hoàn thành COMPLETED job: ${job.id}`);
    return { status: 'success', type: 'COMPLETED' };
  }
  async processFailedJob(job: Job) {
    this.logger.log(`Đang xử lý FAILED job: ${job.id}`);
    
    if (job.data.shouldFail) {
      this.logger.error(`Cố tình gây lỗi cho job: ${job.id}`);
      throw new Error('Job này được cấu hình để thất bại');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.logger.log(`Đã hoàn thành FAILED job: ${job.id}`);
    return { status: 'success', type: 'FAILED' };
  }
  async processDelayedJob(job: Job) {
    this.logger.log(`Đang xử lý DELAYED job: ${job.id} (sau khi bị delay)`);
    // Xử lý nhanh
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.logger.log(`Đã hoàn thành DELAYED job: ${job.id}`);
    return { status: 'success', type: 'DELAYED' };
  }
  async processPausedQueueJob(job: Job) {
    this.logger.log(`Đang xử lý job từ PAUSED queue: ${job.id}`);
    // Xử lý nhanh
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.logger.log(`Đã hoàn thành job từ PAUSED queue: ${job.id}`);
    return { status: 'success', type: 'PAUSED' };
  }
}