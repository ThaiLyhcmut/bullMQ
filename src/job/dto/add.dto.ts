import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddJobDto {
  @ApiProperty({ example: 'sendWelcomeEmail' })
  name: string;

  @ApiProperty({ example: { email: 'user@example.com' } })
  data: any;

  @ApiPropertyOptional({ example: { delay: 5000 } })
  options?: any;
}
