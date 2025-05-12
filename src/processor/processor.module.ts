import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import {MailService} from 'src/mail/mail.service'; import {PostService} from 'src/post/post.service'
import { JobsModule } from 'src/job/job.module';
import { AppProcessor } from './root.processor';


@Module({
  imports: [
    
    BullModule.registerQueue({
      name: 'email',
    }),
    BullModule.registerQueue({
      name: 'posts',
    }),
    
    BullBoardModule.forFeature(
    
      {
        name: 'email',
        adapter: BullMQAdapter
      }
      , 
      {
        name: 'posts',
        adapter: BullMQAdapter
      }
      )
    ,
    JobsModule
  ],
  providers: [AppProcessor, {provide: 'MailService', useClass: MailService}, {provide: 'PostService', useClass: PostService}],
  exports: [ BullModule],
})
export class ProcessorModule {}
  