// src/mail/mail.module.ts
import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  providers: [MailService],
  exports: [MailService], // Cho phép các module khác sử dụng MailService
})
export class MailModule {}
