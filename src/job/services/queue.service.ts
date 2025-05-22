import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue, FlowProducer, ConnectionOptions, JobsOptions } from 'bullmq';

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
      // await job.moveToWaitingChildren(`token-${job.id}`);

      return true;
    } catch (error) {
      this.logger.error(`Lỗi khi thiết lập job ${job.id} để đợi child jobs: ${error.message}`);
      return false;
    }
  }

  /**
   * Tạo child jobs và thiết lập dependencies bằng FlowProducer
   * Bao gồm chức năng truyền kết quả giữa các job
   */
  async createChildJobs(
    parentJob: Job<any>,
    queue: Queue,
    dataChild: any[],
    childJobDataGenerator = (index: number) => ({ index }),
    enableChainResults = false // Thêm tham số để bật chức năng truyền kết quả
  ): Promise<Job | undefined> {
    try {
      const childJobIds: string[] = [];
      let previousJobId: string | null = null;

      // Hàm đệ quy để xây dựng cấu trúc children
      const buildChildren = (
        childData: any[],
        parentId: string | undefined,
        queueName: string,
        prevJobId: string | null = null
      ) => {
        let queueNamePrev = ""
        return childData.map((data, index) => {
          // Tạo ID duy nhất cho job
          const uniqueJobId = `${parentId || 'root'}_child_${index}_${Date.now()}`;
          // Tạo dữ liệu cho child job
          const childDataWithParent = {
            parentId,
            type: data.type,
            ...data.data,
            ...childJobDataGenerator(index),
          };
          let childNode: any = {
            name: data.name,
            queueName: data.queueName || queueName,
            data: childDataWithParent,
            opts: {
              ...data.options || {},
              jobId: uniqueJobId,
            },
          };
          // if (data.type == 'WATTING_CHILDREN') {
          //   childNode = this.createChildJobs(
          //     childNode,
              
          //   ) as any
          // }

          

          // Nếu bật chức năng truyền kết quả và có job trước đó
          if (enableChainResults && prevJobId && index > 0 && queueNamePrev != "") {
            childNode.opts.dependencies = [prevJobId];
            childNode.opts.processDependenciesResults = true;
            childNode.data.queueNamePrev = queueNamePrev
          }

          // Lưu jobId hiện tại để sử dụng cho job tiếp theo
          prevJobId = uniqueJobId;
          queueNamePrev = childNode.queueName
          
          if (childNode.type === "WATTING_CHILDREN") {
            const children = buildChildren(childNode.childJobs, uniqueJobId, childNode, queue.name)
            console.log(children)
            childNode.children = children
          }
          return childNode;
        });
      };
      const jobId = `parent-${Date.now()}`;
      // Tạo flow với parent job và child jobs
      const flow = await this.flowProducer.add({
        name: parentJob.name,
        queueName: queue.name,
        data: parentJob.data,
        opts: {
          ...(parentJob.opts || {}),
          jobId, // đặt trước ID cho job cha
        },
        children: await buildChildren(dataChild, jobId, queue.name, previousJobId),
      });

      // Lấy ID của các child jobs (bao gồm cả grandchild jobs)
      const collectJobIds = (children: any[], parent: Job) => {
        for (const childNode of children) {
          if (childNode.job?.id) {
            childJobIds.push(childNode.job.id);
            this.logger.log(
              `Đã tạo child job ${childNode.job.id} cho parent ${parent.id} với options:`,
              childNode.job.opts,
            );
          }
          if (childNode.children) {
            collectJobIds(childNode.children, parent); // Đệ quy để lấy ID của grandchild jobs
          }
        }
      };

      if (flow.children) {
        collectJobIds(flow.children, flow.job);
      }

      // Cập nhật parent job để đợi child jobs
      await this.moveToWaitingChildren(flow.job, childJobIds);

      return flow.job;
    } catch (error) {
      this.logger.error(`Lỗi khi tạo child jobs cho job : ${error.message}`);
      return undefined;
    }
  }


  async getJobResult(queue: Queue, jobId: string): Promise<any> {
    try {
      const job = await queue.getJob(jobId);
      if (!job) {
        this.logger.warn(`Không tìm thấy job với ID: ${jobId}`);
        return null;
      }

      const state = await job.getState();
      if (state !== 'completed') {
        this.logger.warn(`Job ${jobId} chưa hoàn thành (state: ${state})`);
        return null;
      }

      return job.returnvalue;
    } catch (error) {
      this.logger.error(`Lỗi khi lấy kết quả của job ${jobId}: ${error.message}`);
      return null;
    }
  }

  // Dọn dẹp khi service bị hủy
  async onModuleDestroy() {
    await this.flowProducer.close();
    this.logger.log('Đã đóng FlowProducer trong QueueAdapter');
  }
}