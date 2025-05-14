import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { Queue, Job, JobsOptions, FlowProducer, ConnectionOptions } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { CronJob } from 'cron';
import { ModuleRef } from '@nestjs/core';
import { QueueAdapter } from './queue.service';
import * as fs from 'fs/promises';
import * as path from 'path';
/**
 * JobsService - Service để quản lý các job và cron job trong BullMQ
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly flowProducer: FlowProducer;
  private cronJobs: Map<string, CronJob> = new Map();
  private queues: Map<string, Queue> = new Map();

  constructor(
    private moduleRef: ModuleRef,
    private queueAdapter: QueueAdapter,
  ) {
    const connection: ConnectionOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    };
    if (process.env.REDIS_PASSWORD) {
      connection.password = process.env.REDIS_PASSWORD;
    }
    this.flowProducer = new FlowProducer({ connection });
    this.flowProducer.on('error', (error) => {
      this.logger.error(`FlowProducer error: ${error.message}`);
    });
    console.log("HELLO")
  }

  // Defer job setup until module initialization
  async onModuleInit() {
    console.log("create onModuleInit")
    try {
      await this.setupJobs('../../../src/job/data/post.json');
    } catch (e) {
      this.logger.error(e)
    }
    // try {
    //   await this.setupJobs('../../../src/job/data/email.json');
    // }catch (e) {
    //   this.logger.error(e)
    // }


    this.logger.log('JobsService module initialized');
  }
  // Thiết lập jobs từ file JSON (cron jobs và regular jobs)
  private async setupJobs(pathurl: string) {
    try {
      const configPath = path.resolve(__dirname, pathurl);
      this.logger.log(`Reading jobs from ${configPath}`);
      const rawData = await fs.readFile(configPath, 'utf-8');
      const jobs: Array<{
        queueName: string;
        name: string;
        cronPattern?: string;
        data: any;
        options?: JobsOptions
      }> = JSON.parse(rawData);

      for (const job of jobs) {
        const { queueName, name, cronPattern, data, options } = job;
        if (!queueName || !name || !data) {
          this.logger.warn(`Invalid job config: ${JSON.stringify(job)}`);
          continue;
        }

        if (cronPattern) {
          // Cron job
          await this.addCronJob(queueName, name, cronPattern, data);
          this.logger.log(`Added cron job ${name} for queue ${queueName}`);
        } else {
          // Regular job
          await this.addJob(queueName, name, data, options);
          this.logger.log(`Added regular job ${name} for queue ${queueName}`);
        }
      }

      this.logger.log('Đã thiết lập tất cả jobs thành công');
    } catch (error) {
      this.logger.error(`Lỗi khi thiết lập jobs: ${error.message}`);
      throw error;
    }
  }

  // Lấy queue theo tên
  async getQueue(queueName: string): Promise<Queue> {

    if (this.queues.has(queueName)) {
      return this.queues.get(queueName)!;
    }

    try {
      const queue = await this.moduleRef.get(`BullQueue_${queueName}`, { strict: false });
      if (!queue) {
        throw new NotFoundException(`Queue ${queueName} not found`);
      }
      queue.on('error', (error) => {
        this.logger.error(`Redis error for queue ${queueName}: ${error.message}`);
      });
      this.queues.set(queueName, queue);
      this.logger.log(`Đã lấy queue ${queueName}`);
      return queue;
    } catch (error) {
      throw new NotFoundException({
        message: `Không thể lấy queue ${queueName}`,
        details: error.message,
      });
    }
  }
  // Thêm job vào queue với các tùy chọn
  async addJob(queueName: string, name: string, data: any, options: JobsOptions = {}): Promise<Job> {
    const queue = await this.getQueue(queueName);

    if (data.type === 'PRIORITIZED') {
      options.priority = 1;
    }

    if (data.type === 'DELAYED') {
      options.delay = data.delay || 10000;
    }

    if (data.type === 'PAUSED' && data.pauseQueue) {
      if (!await queue.isPaused()) {
        await queue.pause();
        this.logger.log(`Đã tạm dừng queue ${queueName}`);
        const resumeAfter = data.resumeAfter || 60000;
        setTimeout(async () => {
          if (await queue.isPaused()) {
            await queue.resume();
            this.logger.log(`Đã tiếp tục queue ${queueName}`);
          }
        }, resumeAfter);
      }
    }
    let job: Job;
    if (data.type === 'WAITING_CHILDREN' && data.childJobs?.length > 0) {
      job = await queue.add(name, data, options);

      // Thêm tham số enableChainResults nếu cần truyền kết quả giữa các child jobs
      const enableChainResults = data.enableChainResults === true;

      const childJobIds = await this.queueAdapter.createChildJobs(
        job,
        queue,
        data.childJobs,
        (index) => ({
          parentId: job.id,
          index,
          options: data.childJobs[index].options || {},
        }),
        enableChainResults // Truyền tham số mới
        
      );

      this.logger.log(`Đã thiết lập job ${job.id} với ${childJobIds.length} child jobs ${enableChainResults ? 'có' : 'không'} truyền kết quả`);
    } else {
      job = await queue.add(name, data, options);
      this.logger.log(`Đã thêm job ${name} vào queue ${queueName} - ID: ${job.id} - Type: ${data.type}`);
    }

    return job;
  }
  // Tạo cron job để chạy định kỳ
  async addCronJob(queueName: string, name: string, cronPattern: string, data: any) {
    if (this.cronJobs.has(name)) {
      const existingJob = this.cronJobs.get(name);
      if (existingJob) {
        existingJob.stop();
        this.logger.log(`Đã dừng cron job cũ ${name}`);
      }
    }
    try {
      const queue = await this.getQueue(queueName);
      const job = new CronJob(cronPattern, async () => {
        try {
          await this.addJob(queueName, name, data);
          this.logger.log(`Cron job ${name} đã thêm job vào queue ${queueName}`);
        } catch (error) {
          this.logger.error(`Cron job ${name} thất bại: ${error.message}`);
        }
      });

      this.cronJobs.set(name, job);
      job.start();
      this.logger.log(`Đã bắt đầu cron job ${name} với pattern ${cronPattern}`);
      return {
        queueName,
        name,
        cronPattern,
        data,
        status: 'started',
      };
    } catch (error) {
      this.logger.error(`Không thể thêm cron job ${name}: ${error.message}`);
      throw error;
    }
  }
  // Xóa cron job
  async removeCronJob(name: string) {
    if (this.cronJobs.has(name)) {
      const job = this.cronJobs.get(name);
      if (job) {
        job.stop();
        this.logger.log(`Đã dừng cron job ${name}`);
      }
      this.cronJobs.delete(name);
      return { name, status: 'removed' };
    }
    this.logger.warn(`Không tìm thấy cron job ${name}`);
    return { name, status: 'not_found' };
  }
  // Lấy danh sách tất cả cron jobs
  async getAllCronJobs() {
    const jobs: any[] = [];
    this.cronJobs.forEach((job: any, name) => {
      jobs.push({
        name,
        running: job.running,
        cronTime: job.cronTime.source,
      });
    });
    return jobs;
  }
  // Lấy thông tin trạng thái các queue
  async getQueueStatus(queueName: string) {
    const queue = await this.getQueue(queueName);
    const waitingJobs = await queue.getJobs(['waiting']);
    const prioritizedJobs = waitingJobs.filter((job) => job.opts.priority && job.opts.priority <= 1);
    const waitingChildrenCount = (await queue.getJobs(['waiting-children'])).length;

    return {
      name: queueName,
      counts: {
        waiting: await queue.getWaitingCount(),
        active: await queue.getActiveCount(),
        completed: await queue.getCompletedCount(),
        failed: await queue.getFailedCount(),
        delayed: await queue.getDelayedCount(),
        paused: await queue.isPaused(),
        waiting_children: waitingChildrenCount,
        prioritized: prioritizedJobs.length,
      },
    };
  }
  // Dọn dẹp khi service bị hủy
  async onModuleDestroy() {
    for (const [name, job] of this.cronJobs) {
      job.stop();
      this.logger.log(`Đã dừng cron job ${name} khi destroy`);
    }
    for (const [name, queue] of this.queues) {
      await queue.close();
      this.logger.log(`Đã đóng queue ${name}`);
    }
    await this.flowProducer.close();
    this.cronJobs.clear();
    this.queues.clear();
    this.logger.log('Đã dọn dẹp JobsService');
  }
}