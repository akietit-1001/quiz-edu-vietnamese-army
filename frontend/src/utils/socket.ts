import { io, Socket } from 'socket.io-client';

// Kết nối socket.io DUY NHẤT cho toàn app (đăng ký kênh cá nhân user_{id}) —
// dùng chung giữa App.tsx (icon chuông) và Dashboard.tsx (lời mời/số phòng),
// tránh mở nhiều socket trùng lặp khi cùng gọi registerUser trên cùng 1 tab.
let socket: Socket | null = null;

export const getAppSocket = (): Socket => {
  if (!socket) {
    const socketUrl = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '/');
    socket = io(socketUrl, { autoConnect: false });
  }
  return socket;
};

export const disconnectAppSocket = () => {
  socket?.disconnect();
};
