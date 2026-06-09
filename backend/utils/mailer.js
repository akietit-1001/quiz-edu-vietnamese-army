import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'ndakiet1001@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

/**
 * Sends a registration OTP code via email
 * @param {string} toEmail 
 * @param {string} otpCode 
 */
export const sendRegistrationOTPEmail = async (toEmail, otpCode) => {
  const mailOptions = {
    from: `"Quiz-Edu Học viện KTQS" <${process.env.GMAIL_USER || 'ndakiet1001@gmail.com'}>`,
    to: toEmail,
    subject: 'XÁC THỰC ĐĂNG KÝ TÀI KHOẢN - HỆ THỐNG QUIZ-EDU',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 2px solid #1b3f30; border-radius: 8px; background-color: #faf9f6;">
        <h2 style="color: #1b3f30; text-align: center; border-bottom: 2px solid #1b3f30; padding-bottom: 15px; margin-top: 0; text-transform: uppercase;">
          Chào mừng đồng chí gia nhập Quiz-Edu
        </h2>
        <p>Kính chào đồng chí,</p>
        <p>Đồng chí đang thực hiện đăng ký tài khoản trên hệ thống ôn luyện <strong>Quiz-Edu</strong> (Học viện Kỹ thuật Quân sự).</p>
        <p>Mã OTP xác thực đăng ký của đồng chí là:</p>
        <div style="background-color: #eef2ed; border: 1px solid #1b3f30; border-radius: 6px; padding: 20px; text-align: center; margin: 25px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1b3f30; font-family: 'Courier New', Courier, monospace;">${otpCode}</span>
        </div>
        <p style="color: #da251d; font-size: 13px; font-weight: bold; border-left: 3px solid #da251d; padding-left: 10px;">
          * Lưu ý: Mã này chỉ có hiệu lực trong vòng 10 phút. Tuyệt đối không chia sẻ mã này với bất kỳ ai để bảo mật thông tin quân nhân.
        </p>
        <br/>
        <div style="border-top: 1px solid #d2d7d4; padding-top: 15px; font-size: 12px; color: #555; text-align: center; font-style: italic;">
          <p>HỆ THỐNG QUIZ-EDU - HỌC VIỆN KỸ THUẬT QUÂN SỰ</p>
          <p>Phòng Đào tạo / Trung tâm Công nghệ thông tin</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Registration email sent: ${info.response}`);
    return true;
  } catch (error) {
    console.error('Lỗi gửi email xác thực đăng ký:', error.message);
    return false;
  }
};

/**
 * Sends a 2FA OTP code via email
 * @param {string} toEmail 
 * @param {string} otpCode 
 */
export const send2FAOTPEmail = async (toEmail, otpCode) => {
  const mailOptions = {
    from: `"Quiz-Edu Bảo mật" <${process.env.GMAIL_USER || 'ndakiet1001@gmail.com'}>`,
    to: toEmail,
    subject: 'MÃ XÁC THỰC 2FA (BẢO MẬT) - HỆ THỐNG QUIZ-EDU',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 2px solid #8b6508; border-radius: 8px; background-color: #fcfbf7;">
        <h2 style="color: #8b6508; text-align: center; border-bottom: 2px solid #8b6508; padding-bottom: 15px; margin-top: 0; text-transform: uppercase;">
          Yêu cầu mã xác thực bảo mật (2FA)
        </h2>
        <p>Kính chào đồng chí,</p>
        <p>Hệ thống Quiz-Edu ghi nhận yêu cầu đăng nhập hoặc thiết lập bảo mật hai yếu tố (2FA) từ tài khoản của đồng chí.</p>
        <p>Mã OTP bảo mật của đồng chí là:</p>
        <div style="background-color: #faf5e6; border: 1px solid #8b6508; border-radius: 6px; padding: 20px; text-align: center; margin: 25px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #8b6508; font-family: 'Courier New', Courier, monospace;">${otpCode}</span>
        </div>
        <p style="color: #da251d; font-size: 13px; font-weight: bold; border-left: 3px solid #da251d; padding-left: 10px;">
          * Cảnh báo: Mã OTP này có hiệu lực trong vòng 5 phút. Nếu đồng chí không thực hiện yêu cầu này, vui lòng thay đổi mật khẩu ngay lập tức hoặc liên hệ quản trị viên.
        </p>
        <br/>
        <div style="border-top: 1px solid #d2d7d4; padding-top: 15px; font-size: 12px; color: #555; text-align: center; font-style: italic;">
          <p>HỆ THỐNG AN NINH QUIZ-EDU - HỌC VIỆN KỸ THUẬT QUÂN SỰ</p>
          <p>Hệ thống quản lý ôn luyện và thi trực tuyến an toàn</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`2FA email sent: ${info.response}`);
    return true;
  } catch (error) {
    console.error('Lỗi gửi email xác thực 2FA:', error.message);
    return false;
  }
};

/**
 * Sends a room invitation via email
 * @param {string} toEmail 
 * @param {string} senderName 
 * @param {string} roomCode 
 * @param {string} role 
 * @param {string} link 
 */
export const sendInvitationEmail = async (toEmail, senderName, roomCode, role, link) => {
  const roleText = role === 'examiner' ? 'Giám khảo (Giám sát)' : 'Thí sinh (Người làm bài thi)';
  const mailOptions = {
    from: `"Quiz-Edu Lời mời" <${process.env.GMAIL_USER || 'ndakiet1001@gmail.com'}>`,
    to: toEmail,
    subject: `THƯ MỜI THAM GIA PHÒNG THI ${roomCode} - HỆ THỐNG QUIZ-EDU`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 2px solid #1b3f30; border-radius: 8px; background-color: #faf9f6;">
        <h2 style="color: #1b3f30; text-align: center; border-bottom: 2px solid #1b3f30; padding-bottom: 15px; margin-top: 0; text-transform: uppercase;">
          Thư mời tham gia phòng thi
        </h2>
        <p>Kính chào đồng chí,</p>
        <p>Đồng chí <strong>${senderName}</strong> đã gửi lời mời đồng chí tham gia phòng thi <strong>${roomCode}</strong> với vai trò:</p>
        <div style="background-color: #eef2ed; border-left: 4px solid #e5a93b; padding: 15px; margin: 15px 0; font-weight: bold; color: #1b3f30;">
          Vai trò: ${roleText}
        </div>
        <p>Để tham gia phòng thi này, đồng chí vui lòng click vào đường link dưới đây để đăng nhập và tham gia:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${link}" style="background-color: #e5a93b; color: #1b3f30; font-weight: bold; text-decoration: none; padding: 12px 25px; border-radius: 4px; display: inline-block; text-transform: uppercase;">
            Tham gia phòng thi ngay
          </a>
        </div>
        <p style="font-size: 12px; color: #666; text-align: center;">
          Hoặc copy liên kết này dán vào trình duyệt: <br/>
          <a href="${link}" style="color: #1b3f30;">${link}</a>
        </p>
        <br/>
        <div style="border-top: 1px solid #d2d7d4; padding-top: 15px; font-size: 12px; color: #555; text-align: center; font-style: italic;">
          <p>HỆ THỐNG QUIZ-EDU - HỌC VIỆN KỸ THUẬT QUÂN SỰ</p>
          <p>Hệ thống ôn luyện và thi trực tuyến đồng bộ</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Invitation email sent: ${info.response}`);
    return true;
  } catch (error) {
    console.error('Lỗi gửi email thư mời:', error.message);
    return false;
  }
};
