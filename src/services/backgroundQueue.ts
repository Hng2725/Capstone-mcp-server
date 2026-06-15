import { Queue, Worker, Job } from 'bullmq';
import { redisClient } from './redis.js';

const QUEUE_NAME = 'project-tasks-queue';

// 1. Tạo Hàng Đợi (Queue)
export const taskQueue = new Queue(QUEUE_NAME, { connection: redisClient as any });

// 2. Định nghĩa Dữ liệu Job (Payload)
interface NotificationJob {
    taskId: string;
    action: 'CREATED' | 'UPDATED';
    assigneeId: string;
}

// 3. Khởi tạo Worker - Nằm ngầm và lôi việc ra làm
export const startWorker = () => {
    const worker = new Worker(
        QUEUE_NAME,
        async (job: Job<NotificationJob>) => {
            const { taskId, action, assigneeId } = job.data;
            console.error(`\n[Worker Bắt Đầu] Xử lý Job ${job.id} cho Task ${taskId}`);
            
            // Giả lập tác vụ nặng (ví dụ: Gọi API gửi Email, nén file PDF báo cáo)
            await new Promise((resolve) => setTimeout(resolve, 2000));
            
            // Có thể quăng lỗi giả lập ở đây để test tính năng Thử lại (Retry)
            // if (Math.random() < 0.3) throw new Error("Giả lập lỗi mạng khi gửi email!");
            
            console.error(`[Worker Hoàn Thành] Đã gửi thông báo ${action} cho User ${assigneeId}`);
        },
        { 
            connection: redisClient as any,
            concurrency: 5 // Cho phép xử lý cùng lúc 5 tác vụ
        }
    );

    worker.on('completed', (job) => {
        console.error(`Job ${job.id} đã làm xong suôn sẻ.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} thất bại: ${err.message}`);
    });

    return worker;
};