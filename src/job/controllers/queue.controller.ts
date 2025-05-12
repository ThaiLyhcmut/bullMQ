import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete
} from '@nestjs/common';
import { JobsService } from '../services/job.service';
import { CreateCronJobDto } from '../dto/create.dto'; 
import { AddJobDto } from '../dto/add.dto';
import { ApiTags, ApiBody, ApiParam } from '@nestjs/swagger';

@ApiTags('Queues')
@Controller('queues')
export class QueueController {
  constructor(private readonly jobsService: JobsService) {}

  @Get(':name/status')
  @ApiParam({ name: 'name', example: 'emailQueue' })
  async getQueueStatus(@Param('name') name: string) {
    return this.jobsService.getQueueStatus(name);
  }

  @Get('cron-jobs')
  async getAllCronJobs() {
    return this.jobsService.getAllCronJobs();
  }

  @Post('cron-jobs')
  @ApiBody({ type: CreateCronJobDto })
  async createCronJob(@Body() data: CreateCronJobDto) {
    return this.jobsService.addCronJob(
      data.queueName,
      data.name,
      data.cronPattern,
      data.data
    );
  }

  @Delete('cron-jobs/:name')
  @ApiParam({ name: 'name', example: 'sendDailyEmail' })
  async removeCronJob(@Param('name') name: string) {
    return this.jobsService.removeCronJob(name);
  }

  @Post(':name/jobs')
  @ApiParam({ name: 'name', example: 'emailQueue' })
  @ApiBody({ type: AddJobDto })
  async addJob(@Param('name') queueName: string, @Body() data: AddJobDto) {
    return this.jobsService.addJob(
      queueName,
      data.name,
      data.data,
      data.options
    );
  }
}
