import nodemailer from 'nodemailer';

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'ndakiet1001@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

/**
 * Sends a 2FA OTP code via email
 * @param {string} toEmail 
 * @param {string} otpCode 
 */
export const sendOTPEmail = async (toEmail, otpCode) => {
  const mailOptions = {
    from: `"Quiz-Edu (VPA System)" <${process.env.GMAIL_USER || 'ndakiet1001@gmail.com'}>`,
    to: toEmail,
    subject: 'MÃ XÁC THỰC 2FA - HỆ THỐNG QUIZ-EDU',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #2c3a33; border-radius: 8px; background-color: #fcfbfa;">
        <h2 style="color: #1b3f30; text-align: center; border-bottom: 2px solid #1b3f30; padding-bottom: 10px;">XÁC THỰC HAI YẾU TỐ (2FA)</h2>
        <p>Đồng chí thân mến,</p>
        <p>Hệ thống Quiz-Edu nhận được yêu cầu đăng nhập hoặc xác thực tài khoản của đồng chí. Dưới đây là mã xác thực OTP của đồng chí:</p>
        <div style="background-color: #f4f3ef; border: 1px dashed #2c3a33; border-radius: 4px; padding: 15px; text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #b8860b;">${otpCode}</span>
        </div>
        <p style="color: #da251d; font-size: 13px; font-weight: bold;">* Lưu ý: Mã OTP này có hiệu lực trong vòng 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        <br/>
        <div style="border-top: 1px solid #d2d7d4; padding-top: 15px; font-size: 12px; color: #666; text-align: center;">
          <p>HỆ THỐNG QUIZ-EDU - HỌC VIỆN KỸ THUẬT QUÂN SỰ</p>
          <p>Đơn vị vận hành hệ thống: Phòng Đào tạo / Trung tâm CNTT</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.response}`);
    return true;
  } catch (error) {
    console.error('Lỗi gửi email xác thực OTP:', error.message);
    // Return false instead of failing, so we can support sandbox testing if password is not set
    return false;
  }
};
