import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue, FlowProducer, ConnectionOptions } from 'bullmq';

/**
 * QueueAdapter - Service để quản lý parent-child jobs trong BullMQ
 */
@Injectable()
export class QueueAdapter {
  private readonly logger = new Logger(QueueAdapter.name);
  private readonly flowProducer: FlowProducer;

  constructor() {
    const connection: ConnectionOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || "6379") || 6379,
    };
    if (process.env.REDIS_PASSWORD) {
      connection.password = process.env.REDIS_PASSWORD;
    }
    this.flowProducer = new FlowProducer({ connection });
    this.flowProducer.on('error', (error) => {
      this.logger.error(`FlowProducer error: ${error.message}`);
    });
  }

  /**
   * Thiết lập job để đợi các child jobs hoàn thành
   * Sử dụng API của BullMQ
   */
  async moveToWaitingChildren(job: Job<any>, childJobIds: string[]) {
    try {
      // Cập nhật dữ liệu job với danh sách child job IDs
      await job.updateData({
        ...job.data,
        childJobIds,
      });

      // Sử dụng API moveToWaitingChildren của BullMQ với token
      this.logger.log(`Di chuyển job ${job.id} sang trạng thái waiting-children`);
      await job.moveToWaitingChildren(`token-${job.id}`);

      return true;
    } catch (error) {
      this.logger.error(`Lỗi khi thiết lập job ${job.id} để đợi child jobs: ${error.message}`);
      return false;
    }
  }

  /**
   * Tạo child jobs và thiết lập dependencies bằng FlowProducer
   */
  async createChildJobs(
    parentJob: Job<any>,
    queue: Queue,
    dataChild: any[],
    childJobDataGenerator = (index: number) => ({ index }),
  ): Promise<string[]> {
    try {
      const childJobIds: string[] = [];

      // Hàm đệ quy để xây dựng cấu trúc children
      const buildChildren = (childData: any[], parentId: string | undefined, queueName: string) => {
        return childData.map((data, index) => {
          const childData = {
            parentId,
            type: data.type,
            ...data.data,
            ...childJobDataGenerator(index),
          };
          const childNode:any = {
            name: data.name,
            queueName: data.queueName || queueName, // Sử dụng queueName của parent nếu không có
            data: childData,
            opts: data.options || {},
          };
          // Nếu có children, gọi đệ quy để xử lý job con lồng
          if (data.children && Array.isArray(data.children)) {
            childNode.children = buildChildren(data.children, parentId, data.queueName || queueName);
          }
          return childNode;
        });
      };

      // Tạo flow với parent job và child jobs
      const flow = await this.flowProducer.add({
        name: parentJob.name,
        queueName: queue.name,
        data: parentJob.data,
        opts: parentJob.opts,
        children: buildChildren(dataChild, parentJob.id, queue.name),
      });
      // Lấy ID của các child jobs (bao gồm cả grandchild jobs)
      const collectJobIds = (children: any[]) => {
        for (const childNode of children) {
          if (childNode.job?.id) {
            childJobIds.push(childNode.job.id);
            this.logger.log(
              `Đã tạo child job ${childNode.job.id} cho parent ${parentJob.id} với options:`,
              childNode.job.opts,
            );
          }
          if (childNode.children) {
            collectJobIds(childNode.children); // Đệ quy để lấy ID của grandchild jobs
          }
        }
      };

      if (flow.children) {
        collectJobIds(flow.children);
      }

      // Cập nhật parent job để đợi child jobs
      await this.moveToWaitingChildren(parentJob, childJobIds);

      return childJobIds;
    } catch (error) {
      this.logger.error(`Lỗi khi tạo child jobs cho job ${parentJob.id}: ${error.message}`);
      return [];
    }
  }

  // Dọn dẹp khi service bị hủy
  async onModuleDestroy() {
    await this.flowProducer.close();
    this.logger.log('Đã đóng FlowProducer trong QueueAdapter');
  }
}