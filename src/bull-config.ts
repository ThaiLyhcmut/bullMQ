// Tạo file src/bull-board.config.ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';

// Tạo một ExpressAdapter instance có thể được sử dụng trên toàn ứng dụng
export const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// Tạo một mảng để lưu trữ các Queue được đăng ký
const registeredQueues: BullMQAdapter[] = [];

// Hàm để đăng ký một Queue vào Bull Board
export const registerQueue = (queue: Queue) => {
  const adapter = new BullMQAdapter(queue);
  registeredQueues.push(adapter);
  createBullBoard({
    queues: registeredQueues,
    serverAdapter,
  });
};