import { Module } from '@nestjs/common';
import { StreamService } from './stream.service';
import { StreamGateway } from './stream.gateway';
import { StreamController } from './stream.controller';

@Module({
  providers: [StreamService, StreamGateway],
  exports: [StreamService],
  controllers: [StreamController],
})
export class StreamModule {}