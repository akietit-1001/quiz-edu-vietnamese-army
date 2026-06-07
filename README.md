# Quiz-Edu (MERN - Military Edition)

Hệ thống thi trắc nghiệm và ôn luyện quân sự trực tuyến thiết kế theo phong cách Quân đội nhân dân Việt Nam hiện đại, gọn gàng, trực quan.

## Hướng Dẫn Khởi Chạy Hệ Thống

### 1. Yêu Cầu Hệ Thống
*   Đã cài đặt **Node.js** (Phiên bản v18 trở lên).
*   Đã cài đặt **MongoDB** đang chạy tại máy cục bộ (hoặc chuỗi kết nối Cloud MongoDB Atlas).

### 2. Thiết Lập Biến Môi Trường (Backend)
Mở tệp tin `backend/.env` và cập nhật thông tin tài khoản Gmail của đồng chí:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/quiz-edu
JWT_SECRET=supersecretjwtkey_vpa_style_2026
JWT_REFRESH_SECRET=supersecretrefreshjwtkey_vpa_style_2026

# Gmail integration configuration
GMAIL_USER=ndakiet1001@gmail.com
# Tạo Mật khẩu ứng dụng (App Password) trong Cài đặt bảo mật tài khoản Google của bạn
GMAIL_APP_PASSWORD=your_gmail_app_password
```

### 3. Khởi Chạy Backend (Express + Socket.io)
Mở cửa sổ dòng lệnh tại thư mục `backend/` và thực hiện:
```bash
cd backend
npm run dev
# Hoặc chạy lệnh thông thường
npm start
```
*   Backend Server sẽ khởi chạy tại: `http://localhost:5000`

### 4. Khởi Chạy Frontend (React + TypeScript + Vite + Tailwind v4)
Mở cửa sổ dòng lệnh khác tại thư mục `frontend/` và thực hiện:
```bash
cd frontend
npm run dev
```
*   Frontend Dev Server sẽ khởi chạy tại: `http://localhost:5173`
*   Vite đã được cấu hình proxy để tự động điều hướng các truy vấn `/api/*` về phía backend ở cổng `5000`.

---

## Các Tính Năng Đã Hiện Thực Hóa
1.  **Authentication & 2FA:** Đăng nhập, đăng ký, đăng xuất, tự động gửi mã OTP xác thực 2FA về Gmail.
2.  **Phân Quyền Chi Tiết (RBAC):** `master-admin` (tối cao), `admin` (CRUD phòng, đề, quản lý quân nhân cùng đơn vị), `sub-admin` (xem phòng, CRUD đề thi), `user` (làm đề, tham gia phòng thi).
3.  **Hệ Thống Đề Thi:** Tạo trắc nghiệm, đúng/sai, điền ô trống. Hỗ trợ import đề từ file Word (.docx), Excel (.xlsx/.csv), PDF (.pdf) và export đề ra file Word hành chính quân sự chuẩn chỉnh.
4.  **Phòng Thi Thời Gian Thực:** Quản lý hàng chờ lobby đồng bộ, Host mở khóa thi đồng bộ. Giám sát chống gian lận (visibility tabout detection & khóa toàn màn hình).
5.  **Báo Cáo Kết Quả Chuẩn Quân Sự:** Báo cáo xuất ra Word/Excel có mẫu khung ký tá chuẩn chỉnh của chỉ huy đơn vị (tùy chỉnh linh hoạt qua Popup).
6.  **Đa Ngôn Ngữ i18n:** Hỗ trợ chuyển đổi nhanh tiếng Việt (VI) và tiếng Anh (EN).
