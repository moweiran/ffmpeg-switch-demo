export class StreamSession {
    id: string;
    streamKey: string;
    startTime: number; // 开始时间戳
    lastTimestamp: number; // 最后的时间戳
    // isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  
    constructor(streamKey: string) {
      this.id = Math.random().toString(36).substring(7);
      this.streamKey = streamKey;
      this.startTime = Date.now();
      this.lastTimestamp = 0;
      // this.isActive = true;
      this.createdAt = new Date();
      this.updatedAt = new Date();
    }
  
    updateTimestamp(timestamp: number) {
      this.lastTimestamp = timestamp;
      this.updatedAt = new Date();
    }
  
    stop() {
      // this.isActive = false;
      this.updatedAt = new Date();
    }
  }