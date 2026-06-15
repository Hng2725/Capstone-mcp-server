import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mcp_capstone';
    await mongoose.connect(uri);
    console.error('📦 Đã kết nối thành công tới MongoDB!'); // Dùng console.error để tránh nhiễu luồng Stdio
  } catch (error) {
    console.error('❌ Lỗi kết nối MongoDB:', error);
    process.exit(1);
  }
};