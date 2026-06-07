import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  vi: {
    translation: {
      "app_title": "Hệ thống Thi & Ôn luyện Trắc nghiệm Quân sự - Quiz-Edu",
      "login": "Đăng nhập",
      "register": "Đăng ký",
      "logout": "Đăng xuất",
      "email": "Gmail công tác",
      "password": "Mật khẩu",
      "fullName": "Họ và tên",
      "dob": "Ngày tháng năm sinh",
      "rank": "Cấp bậc quân hàm",
      "position": "Chức vụ",
      "unit": "Đơn vị công tác",
      "address": "Địa chỉ",
      "role": "Quyền hạn",
      "submit": "Nộp bài",
      "cancel": "Hủy bỏ",
      "confirm": "Xác nhận",
      "save": "Lưu lại",
      "edit": "Chỉnh sửa",
      "delete": "Xóa",
      "create": "Tạo mới",
      "search": "Tìm kiếm",
      "room_code": "Mã phòng thi",
      "enter_code": "Nhập mã phòng (6 ký tự)",
      "join_room": "Vào phòng thi",
      "lobby": "Hàng chờ phòng thi",
      "waiting_host": "Đang chờ chỉ huy mở đề thi...",
      "anti_cheat_warning": "Chú ý: Hệ thống đang giám sát chống gian lận. Rời màn hình thi quá số lần quy định sẽ tự động nộp bài!",
      "exam_duration": "Thời gian làm bài",
      "passing_score": "Điểm đạt yêu cầu",
      "category": "Chuyên ngành",
      "politics": "Chính trị",
      "military": "Quân sự",
      "tradition": "Truyền thống quân đội",
      "logistics": "Hậu cần - Kỹ thuật",
      "regulation": "Điều lệnh",
      "other": "Khác",
      "mock_test": "Thi thử",
      "practice": "Ôn luyện",
      "score_result": "Số câu đúng",
      "result": "Kết quả",
      "rank_classification": "Xếp loại",
      "passed": "ĐẠT",
      "failed": "KHÔNG ĐẠT",
      "rank_excellent": "Xuất sắc",
      "rank_good": "Giỏi",
      "rank_fair": "Khá",
      "rank_average": "Trung bình",
      "rank_weak": "Yếu",
      "violations": "Số lần chuyển tab",
      "export": "Xuất tệp tin",
      "import": "Nhập tệp tin"
    }
  },
  en: {
    translation: {
      "app_title": "Military Quiz & Practice Portal - Quiz-Edu",
      "login": "Sign In",
      "register": "Register",
      "logout": "Sign Out",
      "email": "Military Email",
      "password": "Password",
      "fullName": "Full Name",
      "dob": "Date of Birth",
      "rank": "Military Rank",
      "position": "Duty Position",
      "unit": "Military Unit",
      "address": "Address",
      "role": "Permission Role",
      "submit": "Submit",
      "cancel": "Cancel",
      "confirm": "Confirm",
      "save": "Save Changes",
      "edit": "Edit",
      "delete": "Delete",
      "create": "Create New",
      "search": "Search",
      "room_code": "Room Code",
      "enter_code": "Enter 6-char Code",
      "join_room": "Enter Exam Room",
      "lobby": "Waiting Lobby",
      "waiting_host": "Waiting for host to open the exam...",
      "anti_cheat_warning": "Warning: Anti-cheat system active. Leaving the exam tab will trigger auto-submission!",
      "exam_duration": "Duration",
      "passing_score": "Passing Score",
      "category": "Category",
      "politics": "Politics",
      "military": "Military",
      "tradition": "Army Traditions",
      "logistics": "Logistics & Tech",
      "regulation": "Regulations",
      "other": "Other",
      "mock_test": "Mock Test",
      "practice": "Practice Mode",
      "score_result": "Score",
      "result": "Result",
      "rank_classification": "Rank",
      "passed": "PASSED",
      "failed": "FAILED",
      "rank_excellent": "Excellent",
      "rank_good": "Good",
      "rank_fair": "Fair",
      "rank_average": "Average",
      "rank_weak": "Weak",
      "violations": "Tab Switches",
      "export": "Export File",
      "import": "Import File"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'vi',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
