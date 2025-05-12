import { ApiProperty } from '@nestjs/swagger';

export class CreateCronJobDto {
  @ApiProperty({ example: 'emailQueue' })
  queueName: string;

  @ApiProperty({ example: 'sendDailyEmail' })
  name: string;

  @ApiProperty({ example: '0 8 * * *', description: 'Cron pattern for daily at 8AM' })
  cronPattern: string;

  @ApiProperty({ example: { email: 'user@example.com' } })
  data: any;
}
