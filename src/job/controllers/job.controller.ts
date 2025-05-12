// Tạo file src/jobs/jobs.controller.ts
import { Controller, Get, Post, Body, Delete, Param, NotFoundException } from '@nestjs/common';
import { JobsService } from '../services/job.service';
import { DatabaseService } from '../services/database.service';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly dataService: DatabaseService
  ) { }

  @Get(':collection')
  async getCollection(@Param('collection') collectionName: string) {
    const exists = await this.dataService.collectionExists(collectionName);
    if (!exists) {
      throw new NotFoundException(`Collection ${collectionName} does not exist`);
    }
    return { exists, collection: collectionName };
  }

  @Get('queue/:queue')
  async getQueue(@Param('queue') queue: string) {
    const queueInstance = await this.jobsService.getQueue(queue);
    if (!queueInstance) {
      throw new NotFoundException(`Queue ${queue} does not exist`);
    }
    
    // Return only necessary queue information
    return {
      name: queue,
      exists: true,
      status: 'active',
      jobs: await queueInstance.getJobCounts()
    };
  }
}