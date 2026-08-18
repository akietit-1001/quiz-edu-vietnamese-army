import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll } from 'vitest';

// Phải set các biến môi trường NÀY trước khi bất kỳ test file nào
// `await import('../server.js')` — server.js đọc process.env.MONGODB_URI
// ngay khi được import (connectDB() chạy ở top-level), nên set ở đây (module
// setup, chạy trước khi test file được load) để tránh việc test lỡ tay kết
// nối vào MongoDB Atlas / Redis thật của production.
const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri();
process.env.JWT_SECRET = 'test_jwt_secret_ephemeral_do_not_use_in_prod';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_ephemeral_do_not_use_in_prod';
process.env.PORT = '5599';
process.env.NODE_ENV = 'test';
// Vô hiệu hoá thật sự các dịch vụ bên thứ ba trong lúc test — không được
// phép gửi email thật hay gọi Gemini AI thật trong bất kỳ test case nào.
process.env.BREVO_API_KEY = 'test-invalid-key';
process.env.GEMINI_API_KEY = 'test-invalid-key';
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '1'; // cổng không tồn tại — buộc ioredis lỗi nhanh, không đụng Redis thật

globalThis.__TEST_MONGOD__ = mongod;

afterAll(async () => {
  const mongoose = (await import('mongoose')).default;
  await mongoose.connection.close();
  await mongod.stop();
});
