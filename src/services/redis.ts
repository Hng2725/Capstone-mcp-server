import { Redis } from 'ioredis';

// Khởi tạo Singleton Redis Client để tái sử dụng
export const redisClient = new Redis(process.env.REDIS_URI || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null, // Yêu cầu của BullMQ
});

redisClient.on('connect', () => {
    console.error('Đã kết nối thành công tới Redis!');
});

redisClient.on('error', (err) => {
    console.error('Lỗi kết nối Redis:', err.message);
});

// Hàm hỗ trợ Cache-Aside thông minh
export async function getOrSetCache<T>(key: string, ttlSeconds: number, fetchFunction: () => Promise<T>): Promise<T> {
    const cachedData = await redisClient.get(key);
    if (cachedData) {
        console.error(`[Cache HIT] Lấy dữ liệu siêu tốc từ Redis: ${key}`);
        return JSON.parse(cachedData) as T;
    }

    console.error(`[Cache MISS] Đang đọc từ Database: ${key}`);
    const freshData = await fetchFunction();
    
    // Lưu vào cache để lần sau lấy nhanh hơn
    await redisClient.set(key, JSON.stringify(freshData), 'EX', ttlSeconds);
    return freshData;
}

// Hàm hỗ trợ vô hiệu hóa Cache (Invalidation)
export async function invalidateCache(keyPattern: string) {
    const keys = await redisClient.keys(keyPattern);
    if (keys.length > 0) {
        await redisClient.del(...keys);
        console.error(`Đã dọn dẹp ${keys.length} bộ nhớ đệm khớp với: ${keyPattern}`);
    }
}