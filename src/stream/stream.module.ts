import { Module } from '@nestjs/common';
import { StreamService } from './stream.service';
import { StreamController } from './stream.controller';

@Module({
  providers: [StreamService],
  exports: [StreamService],
  controllers: [StreamController],
})
export class StreamModule {}