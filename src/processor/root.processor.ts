// src/jobs/processors/app.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Scope } from '@nestjs/common';
import { Job } from 'bullmq';
import { ModuleRef } from '@nestjs/core';

@Processor({name:  "*",scope: Scope.REQUEST}) // Wildcard to match all queues
export class AppProcessor extends WorkerHost {
  private readonly logger = new Logger(AppProcessor.name);

  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.id} (${job.name}) from queue ${job.queueName}`);

    try {
      // Expect job.name to be in the format "serviceName.methodName"
      const [serviceName, methodName] = job.name.split('.');
      if (!serviceName || !methodName) {
        throw new Error(`Invalid job name format: ${job.name}. Expected format: serviceName.methodName`);
      }

      // Resolve the service from the DI container
      let service: any;
      try {
        service = this.moduleRef.get(serviceName, { strict: false });
      } catch (error) {
        throw new Error(`Service ${serviceName} not found in DI container`);
      }

      // Verify the method exists on the service
      if (!service || typeof service[methodName] !== 'function') {
        throw new Error(`Method ${methodName} not found in service ${serviceName}`);
      }

      // Execute the method with the job data
      this.logger.debug(`Executing ${serviceName}.${methodName} with data: ${JSON.stringify(job.data)}`);
      const result = await service[methodName](job);
      this.logger.log(`Job ${job.id} (${job.name}) completed successfully`);

      return result;
    } catch (error) {
      this.logger.error(`Error processing job ${job.id} (${job.name}) from queue ${job.queueName}: ${error.message}`, error.stack);
      throw error; // Re-throw to let BullMQ handle retries or move to failed queue
    }
  }
}