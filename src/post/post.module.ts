// src/mail/mail.module.ts
import { Module } from '@nestjs/common';
import { PostService } from './post.service';

@Module({
  providers: [PostService],
  exports: [PostService], // Cho phép các module khác sử dụng MailService
})
export class PostModule {}
