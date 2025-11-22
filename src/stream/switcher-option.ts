export interface SwitcherOptions {
    outputUrl: string;
    safeIntervalMs?: number; // 终止后等待 RTMP 释放的安全间隔（ms），默认 2000
    gracefulTimeoutMs?: number; // 等待进程优雅退出的时间，默认 3000
    spawnTimeoutMs?: number; // 新进程 spawn 后认为启动成功的等待时间，默认 700
    retryLimit?: number; // 当启动失败时最大重试次数
    useStreamLoop?: boolean; // 新增：是否使用 stream_loop
}