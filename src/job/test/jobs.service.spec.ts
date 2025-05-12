import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from '../services/job.service'; 
import { ModuleRef } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
import { Queue } from 'bull';
import { CronJob } from 'cron';

// Mock CronJob để kiểm soát hành vi
jest.mock('cron', () => {
  return {
    CronJob: jest.fn().mockImplementation((cronTime, onTick) => ({
      start: jest.fn(),
      stop: jest.fn(),
      running: true,
      cronTime: { source: cronTime },
      fireOnTick: onTick,
    })) as unknown as jest.Mock,
  };
});

describe('JobsService', () => {
  let service: JobsService;
  let moduleRef: ModuleRef;
  let mockQueue: Partial<Queue>;

  // Mock queue để mô phỏng BullMQ
  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: ModuleRef,
          useValue: {
            get: jest.fn().mockImplementation((token) => {
              if (token === getQueueToken('posts')) {
                return mockQueue;
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    moduleRef = module.get<ModuleRef>(ModuleRef);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getQueue', () => {
    it('nên trả về queue nếu đã tồn tại trong cache', async () => {
      // Arrange: Thêm queue vào cache
      const queueName = 'posts';
      // @ts-ignore: Bỏ qua lỗi private
      service['queues'].set(queueName, mockQueue as Queue);

      // Act
      const queue = await service.getQueue(queueName);

      // Assert
      expect(queue).toBe(mockQueue);
      expect(moduleRef.get).not.toHaveBeenCalled();
    });

    it('nên lấy queue từ ModuleRef nếu chưa có trong cache', async () => {
      // Arrangement
      const queueName = 'posts';

      // Act
      const queue = await service.getQueue(queueName);

      // Assert
      expect(queue).toBe(mockQueue);
      expect(moduleRef.get).toHaveBeenCalledWith(getQueueToken(queueName), { strict: false });
    });

    it('nên throw NotFoundException nếu queue không tồn tại', async () => {
      // Arrangement
      const queueName = 'unknown';
      jest.spyOn(moduleRef, 'get').mockReturnValue(null);

      // Act & Assert
      await expect(service.getQueue(queueName)).rejects.toThrow(
        new NotFoundException(`Queue ${queueName} not found`),
      );
    });
  });

  describe('addJob', () => {
    it('nên thêm job vào queue thành công', async () => {
      // Arrangement
      const queueName = 'posts';
      const jobName = 'testJob';
      const data = { key: 'value' };
      const options = { priority: 1 };

      // Act
      const job = await service.addJob(queueName, jobName, data, options);

      // Assert
      expect(job).toEqual({ id: 'job-123' });
      expect(mockQueue.add).toHaveBeenCalledWith(jobName, data, {
        removeOnComplete: true,
        priority: 1,
      });
    });

    it('nên throw NotFoundException nếu queue không tồn tại', async () => {
      // Arrangement
      const queueName = 'unknown';
      jest.spyOn(moduleRef, 'get').mockReturnValue(null);

      // Act & Assert
      await expect(service.addJob(queueName, 'testJob', {})).rejects.toThrow(
        new NotFoundException(`Queue ${queueName} not found`),
      );
    });
  });

  describe('addTimedJob', () => {
    it('nên thêm timed job với completionTime', async () => {
      // Arrangement
      const queueName = 'posts';
      const jobName = 'timedJob';
      const data = { key: 'value' };
      const completionTimeMs = 3000;

      // Act
      const job = await service.addTimedJob(queueName, jobName, data, completionTimeMs);

      // Assert
      expect(job).toEqual({ id: 'job-123' });
      expect(mockQueue.add).toHaveBeenCalledWith(
        jobName,
        expect.objectContaining({
          key: 'value',
          __completionTime: expect.any(Number),
        }),
        { removeOnComplete: true },
      );
    });

    it('nên mô phỏng job hoàn thành sau delay', async () => {
      // Arrangement
      const queueName = 'posts';
      const jobName = 'timedJob';
      const data = { key: 'value' };
      const completionTimeMs = 100; // Delay ngắn để test nhanh

      // Act
      const job = await service.addTimedJob(queueName, jobName, data, completionTimeMs);

      // Mô phỏng job hoàn thành sau delay
      await new Promise((resolve) => setTimeout(resolve, completionTimeMs + 50));

      // Assert
      expect(job).toEqual({ id: 'job-123' });
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('nên throw error nếu queue không tồn tại', async () => {
      // Arrangement
      const queueName = 'unknown';
      jest.spyOn(moduleRef, 'get').mockReturnValue(null);

      // Act & Assert
      await expect(service.addTimedJob(queueName, 'timedJob', {}, 1000)).rejects.toThrow(
        new NotFoundException(`Queue ${queueName} not found`),
      );
    });
  });

  describe('addCronJob', () => {
    it('nên tạo và bắt đầu cron job', async () => {
      // Arrangement
      const queueName = 'posts';
      const jobName = 'cronJob';
      const cronPattern = '*/5 * * * * *';
      const data = { key: 'value' };

      // Act
      const result = await service.addCronJob(queueName, jobName, cronPattern, data);

      // Assert
      expect(result).toEqual({
        queueName,
        name: jobName,
        cronPattern,
        data,
        status: 'started',
      });
      expect(CronJob).toHaveBeenCalledWith(cronPattern, expect.any(Function));
      const cronJob = (CronJob as jest.Mock).mock.results[0].value;
      expect(cronJob.start).toHaveBeenCalled();
    });

    it('nên dừng cron job cũ nếu đã tồn tại', async () => {
      // Arrangement
      const queueName = 'posts';
      const jobName = 'cronJob';
      const cronPattern = '*/5 * * * * *';
      const data = { key: 'value' };
      const mockCronJob = new (CronJob as unknown as jest.Mock)();
      // @ts-ignore: Bỏ qua lỗi private
      service['cronJobs'].set(jobName, mockCronJob);

      // Act
      await service.addCronJob(queueName, jobName, cronPattern, data);

      // Assert
      expect(mockCronJob.stop).toHaveBeenCalled();
    });

    it('nên chạy cron job và thêm job vào queue sau delay', async () => {
      // Arrangement
      const queueName = 'posts';
      const jobName = 'cronJob';
      const cronPattern = '*/5 * * * * *';
      const data = { key: 'value' };

      // Act
      await service.addCronJob(queueName, jobName, cronPattern, data);
      const cronJob = (CronJob as jest.Mock).mock.results[0].value;

      // Mô phỏng cron job chạy sau 100ms
      await new Promise((resolve) => setTimeout(() => {
        cronJob.fireOnTick();
        resolve(null);
      }, 100));

      // Assert
      expect(mockQueue.add).toHaveBeenCalledWith(jobName, data, { removeOnComplete: true });
    });
  });

  describe('removeCronJob', () => {
    it('nên xóa cron job nếu tồn tại', async () => {
      // Arrangement
      const jobName = 'cronJob';
      const mockCronJob = new (CronJob as unknown as jest.Mock)();
      // @ts-ignore: Bỏ qua lỗi private
      service['cronJobs'].set(jobName, mockCronJob);

      // Act
      const result = await service.removeCronJob(jobName);

      // Assert
      expect(result).toEqual({ name: jobName, status: 'removed' });
      expect(mockCronJob.stop).toHaveBeenCalled();
      // @ts-ignore: Bỏ qua lỗi private
      expect(service['cronJobs'].has(jobName)).toBe(false);
    });

    it('nên trả về not_found nếu cron job không tồn tại', async () => {
      // Arrangement
      const jobName = 'unknown';

      // Act
      const result = await service.removeCronJob(jobName);

      // Assert
      expect(result).toEqual({ name: jobName, status: 'not_found' });
    });
  });

  describe('getAllCronJobs', () => {
    it('nên trả về danh sách tất cả cron jobs', async () => {
      // Arrangement
      const jobName = 'cronJob';
      const cronPattern = '*/5 * * * * *';
      const mockCronJob = new (CronJob as unknown as jest.Mock)(cronPattern, () => {});
      // @ts-ignore: Bỏ qua lỗi private
      service['cronJobs'].set(jobName, mockCronJob);

      // Act
      const jobs = await service.getAllCronJobs();

      // Assert
      expect(jobs).toEqual([
        {
          name: jobName,
          running: true,
          cronTime: cronPattern,
        },
      ]);
    });

    it('nên trả về mảng rỗng nếu không có cron job', async () => {
      // Act
      const jobs = await service.getAllCronJobs();

      // Assert
      expect(jobs).toEqual([]);
    });
  });

  describe('createAutoCompletingJob', () => {
    it('nên tạo timed job mỗi 5 giây', async () => {
      // Arrangement
      jest.spyOn(service, 'addTimedJob');

      // Act
      // @ts-ignore: Bỏ qua lỗi private
      await service.createAutoCompletingJob();

      // Assert
      expect(service['addTimedJob']).toHaveBeenCalledWith(
        'posts',
        expect.stringContaining('autoCompleteJob'),
        expect.objectContaining({
          userId: 123,
          jobId: expect.any(Number),
          createdAt: expect.any(String),
          message: 'Job này sẽ tự hoàn thành sau 3 giây',
        }),
        3000,
      );
    });
  });

  describe('dailyDatabaseCleanup', () => {
    it('nên thêm job dọn dẹp database thành công', async () => {
      // Arrangement
      jest.spyOn(service, 'addJob');

      // Act
      // @ts-ignore: Bỏ qua lỗi private
      await service.dailyDatabaseCleanup();

      // Assert
      expect(service['addJob']).toHaveBeenCalledWith(
        'posts',
        'databaseCleanup',
        expect.objectContaining({
          tables: ['logs', 'temp_data', 'expired_sessions'],
          olderThan: '30d',
          timestamp: expect.any(String),
        }),
        expect.objectContaining({
          priority: 5,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10000 },
        }),
      );
    });

    it('nên xử lý lỗi khi thêm job thất bại', async () => {
      // Arrangement
      jest.spyOn(service, 'addJob').mockRejectedValue(new Error('Queue error'));
      const loggerSpy = jest.spyOn(service['logger'], 'error');

      // Act
      // @ts-ignore: Bỏ qua lỗi private
      await service.dailyDatabaseCleanup();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Lỗi khi thêm job dọn dẹp: Queue error'),
      );
    });
  });
});