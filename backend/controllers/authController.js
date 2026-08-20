import crypto from 'crypto';
import User from '../models/User.js';
import TempUser from '../models/TempUser.js';
import Unit from '../models/Unit.js';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { sendRegistrationOTPEmail, send2FAOTPEmail, sendPasswordResetOTPEmail } from '../utils/mailer.js';

// Sinh mã OTP 6 chữ số bằng CSPRNG (crypto.randomInt) thay vì Math.random(),
// vốn không an toàn để dùng cho mục đích bảo mật (dự đoán được seed/state).
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

// Helper to generate access and refresh tokens
// `v` (tokenVersion) được nhúng vào cả 2 token — cho phép thu hồi tức thời
// (logout, đổi mật khẩu) bằng cách tăng User.tokenVersion, thay vì phải chờ
// token hết hạn tự nhiên.
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role, unitId: user.unitId?._id || user.unitId, v: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user._id, v: user.tokenVersion || 0 },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Đặt lại cookie refreshToken với cùng cấu hình dùng chung ở mọi nơi phát token
const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};

// Chuẩn hoá field `unit` trả về client — object {id, name, level} thay vì
// ObjectId thô. Cần user.unitId đã được populate trước khi gọi hàm này.
const formatUnit = (unit) => {
  if (!unit || !unit.name) return null;
  return { id: unit._id, name: unit.name, level: unit.level };
};

// 1. REGISTER
export const register = async (req, res) => {
  try {
    const { personnelType, email, username, password, fullName, dateOfBirth, rank, position, unitId, address } = req.body;

    if (!unitId) {
      return res.status(400).json({ message: 'Vui lòng chọn đơn vị công tác' });
    }

    const unit = await Unit.findById(unitId);
    if (!unit) {
      return res.status(400).json({ message: 'Đơn vị không hợp lệ' });
    }

    // Chiến sĩ: không có email thật để nhận OTP -> tạo tài khoản ngay bằng
    // username, bỏ qua bước xác thực OTP qua email.
    if (personnelType === 'soldier') {
      if (!username || !username.trim()) {
        return res.status(400).json({ message: 'Vui lòng nhập tên đăng nhập' });
      }
      const normalizedUsername = username.trim().toLowerCase();
      const usernameExists = await User.findOne({ username: normalizedUsername });
      if (usernameExists) {
        return res.status(400).json({ message: 'Tên đăng nhập này đã được sử dụng' });
      }

      const userCount = await User.countDocuments({});
      const role = userCount === 0 ? 'master-admin' : 'user';

      let newSoldier = await User.create({
        personnelType,
        username: normalizedUsername,
        password,
        fullName,
        dateOfBirth,
        rank,
        position,
        unitId,
        address,
        role,
        managedBy: null
      });
      newSoldier = await newSoldier.populate('unitId', 'name level');

      const { accessToken, refreshToken } = generateTokens(newSoldier);
      setRefreshTokenCookie(res, refreshToken);

      return res.status(201).json({
        message: 'Đăng ký tài khoản Chiến sĩ thành công',
        user: {
          id: newSoldier._id,
          username: newSoldier.username,
          personnelType: newSoldier.personnelType,
          fullName: newSoldier.fullName,
          role: newSoldier.role,
          unit: formatUnit(newSoldier.unitId),
          rank: newSoldier.rank,
          position: newSoldier.position,
          twoFactorEnabled: newSoldier.twoFactorEnabled
        },
        accessToken
      });
    }

    if (!email) {
      return res.status(400).json({ message: 'Vui lòng nhập email' });
    }

    // Check if user exists in permanent database
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Email này đã được đăng ký sử dụng' });
    }

    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create or update record in TempUser
    await TempUser.findOneAndUpdate(
      { email },
      {
        email,
        otpCode,
        expiresAt,
        userData: { email, password, fullName, dateOfBirth, rank, position, unitId, address },
        createdAt: new Date() // Reset TTL timer
      },
      { upsert: true, new: true }
    );

    // Send registration OTP email
    const sent = await sendRegistrationOTPEmail(email, otpCode);

    res.status(200).json({
      requiresVerification: true,
      email,
      message: sent 
        ? 'Mã OTP xác thực tài khoản đã được gửi về Gmail của đồng chí. Vui lòng xác thực để hoàn tất đăng ký.'
        : 'Đã ghi nhận yêu cầu đăng ký nhưng lỗi gửi mail OTP. Vui lòng kiểm tra lại thiết lập email hoặc thử lại.'
    });
  } catch (error) {
    console.error('Lỗi đăng ký:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi đăng ký tài khoản' });
  }
};

// 2. LOGIN
// 2. LOGIN
export const login = async (req, res) => {
  try {
    // `identifier`: email (Cán bộ) hoặc username (Chiến sĩ). Giữ lại `email`
    // để tương thích ngược với client cũ chưa cập nhật.
    const { identifier, email, password } = req.body;
    const loginId = (identifier || email || '').trim().toLowerCase();

    // Find user by either email or username
    const user = await User.findOne({ $or: [{ email: loginId }, { username: loginId }] }).populate('unitId', 'name level');
    if (!user) {
      return res.status(401).json({ message: 'Tài khoản hoặc mật khẩu không chính xác' });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Tài khoản hoặc mật khẩu không chính xác' });
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Generate email OTP for 2FA
      // Generate a simple 6-digit OTP code using otplib or simple random
      const otpCode = generateOtp();
      
      // Store OTP and expiry in user document temporarily
      user.twoFactorSecret = JSON.stringify({
        code: otpCode,
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
      });
      await user.save();

      // Send OTP to user's real email
      const sent = await send2FAOTPEmail(user.email, otpCode);

      return res.status(200).json({
        requires2FA: true,
        email: user.email,
        message: sent 
          ? 'Mã OTP đã được gửi về Gmail của đồng chí. Vui lòng kiểm tra.'
          : 'Lỗi gửi email OTP, vui lòng liên hệ admin hoặc thử lại.'
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      message: 'Đăng nhập thành công',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        personnelType: user.personnelType,
        fullName: user.fullName,
        role: user.role,
        unit: formatUnit(user.unitId),
        rank: user.rank,
        position: user.position,
        twoFactorEnabled: user.twoFactorEnabled
      },
      accessToken
    });
  } catch (error) {
    console.error('Lỗi đăng nhập:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập' });
  }
};

// 3. VERIFY 2FA
export const verify2FA = async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email }).populate('unitId', 'name level');
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    if (!user.twoFactorSecret) {
      return res.status(400).json({ message: 'Yêu cầu 2FA không hợp lệ' });
    }

    try {
      const otpData = JSON.parse(user.twoFactorSecret);
      if (otpData.code !== code || Date.now() > otpData.expiresAt) {
        return res.status(400).json({ message: 'Mã xác thực không hợp lệ hoặc đã hết hạn' });
      }
    } catch (e) {
      return res.status(400).json({ message: 'Lỗi dữ liệu xác thực 2FA' });
    }

    // 2FA code is valid, clear it
    user.twoFactorSecret = '';
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user);
    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      message: 'Đăng nhập 2FA thành công',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        unit: formatUnit(user.unitId),
        rank: user.rank,
        position: user.position,
        twoFactorEnabled: user.twoFactorEnabled
      },
      accessToken
    });
  } catch (error) {
    console.error('Lỗi xác thực 2FA:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi xác thực 2FA' });
  }
};

// 3.5. VERIFY REGISTRATION OTP
export const verifyRegister = async (req, res) => {
  try {
    const { email, code } = req.body;

    const tempUser = await TempUser.findOne({ email });
    if (!tempUser) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin đăng ký của người dùng này hoặc mã đã hết hạn. Vui lòng thực hiện đăng ký lại.' });
    }

    if (tempUser.otpCode !== code || Date.now() > tempUser.expiresAt) {
      return res.status(400).json({ message: 'Mã xác thực đăng ký không hợp lệ hoặc đã hết hạn' });
    }

    // Check if user already exists (prevent duplicate creation)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await TempUser.deleteOne({ email });
      return res.status(400).json({ message: 'Email này đã được đăng ký sử dụng' });
    }

    // First user is master-admin, others are user by default
    const userCount = await User.countDocuments({});
    const role = userCount === 0 ? 'master-admin' : 'user';

    // Create the permanent record in User collection
    // managedBy: null vì đây là tự đăng ký, chưa có cấp trên trực tiếp gán
    let user = await User.create({
      ...tempUser.userData,
      role,
      managedBy: null
    });

    // Delete the temporary document from TempUser
    await TempUser.deleteOne({ email });

    user = await user.populate('unitId', 'name level');

    const { accessToken, refreshToken } = generateTokens(user);
    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      message: 'Xác thực tài khoản thành công',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        unit: formatUnit(user.unitId),
        rank: user.rank,
        position: user.position,
        twoFactorEnabled: user.twoFactorEnabled
      },
      accessToken
    });
  } catch (error) {
    console.error('Lỗi xác thực đăng ký:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi xác thực đăng ký' });
  }
};

// 4. SETUP 2FA (Enable 2FA option in settings)
export const setup2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    if (!user.email) {
      return res.status(400).json({ message: 'Tài khoản Chiến sĩ không có email nên không thể bật xác thực hai yếu tố (2FA)' });
    }

    // We will use Email OTP for 2FA. Send a test OTP code to verify setup
    const otpCode = generateOtp();
    
    // Temporarily save secret
    user.twoFactorSecret = JSON.stringify({
      code: otpCode,
      expiresAt: Date.now() + 5 * 60 * 1000
    });
    await user.save();

    const sent = await send2FAOTPEmail(user.email, otpCode);

    res.status(200).json({
      message: sent 
        ? 'Mã OTP xác nhận thiết lập 2FA đã được gửi về Gmail của đồng chí.'
        : 'Lỗi gửi email OTP, vui lòng kiểm tra lại thiết lập SMTP hoặc email của đồng chí.'
    });
  } catch (error) {
    console.error('Lỗi thiết lập 2FA:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi thiết lập 2FA' });
  }
};

// 5. CONFIRM AND ENABLE 2FA
export const enable2FA = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ message: 'Yêu cầu kích hoạt không hợp lệ' });
    }

    try {
      const otpData = JSON.parse(user.twoFactorSecret);
      if (otpData.code !== code || Date.now() > otpData.expiresAt) {
        return res.status(400).json({ message: 'Mã xác thực không hợp lệ hoặc đã hết hạn' });
      }
    } catch (e) {
      return res.status(400).json({ message: 'Lỗi dữ liệu xác thực 2FA' });
    }

    // Enable 2FA
    user.twoFactorEnabled = true;
    user.twoFactorSecret = '';
    await user.save();

    res.status(200).json({
      message: 'Đã kích hoạt xác thực hai yếu tố (2FA) thành công',
      twoFactorEnabled: true
    });
  } catch (error) {
    console.error('Lỗi kích hoạt 2FA:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi kích hoạt 2FA' });
  }
};

// 6. DISABLE 2FA
export const disable2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = '';
    await user.save();

    res.status(200).json({
      message: 'Đã hủy kích hoạt xác thực hai yếu tố (2FA) thành công',
      twoFactorEnabled: false
    });
  } catch (error) {
    console.error('Lỗi hủy kích hoạt 2FA:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi hủy kích hoạt 2FA' });
  }
};

// 7. REFRESH TOKEN
export const refreshToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ message: 'Không có refresh token' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Tài khoản không tồn tại' });
    }

    // Token đã bị thu hồi (logout/đổi mật khẩu ở nơi khác tăng tokenVersion)
    if ((decoded.v || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ message: 'Phiên đăng nhập đã bị thu hồi, vui lòng đăng nhập lại' });
    }

    // Rotation: phát refresh token MỚI mỗi lần refresh thay vì tái sử dụng
    // token cũ tới hết hạn — giảm thời gian sống hữu ích nếu token bị lộ.
    const tokens = generateTokens(user);
    setRefreshTokenCookie(res, tokens.refreshToken);

    res.status(200).json({
      accessToken: tokens.accessToken
    });
  } catch (error) {
    return res.status(401).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
  }
};

// 8. LOGOUT
export const logout = async (req, res) => {
  // Thu hồi ngay mọi access/refresh token đã phát hành trước đó (kể cả token
  // truy cập 15 phút còn hiệu lực) bằng cách tăng tokenVersion — không chỉ
  // dựa vào việc xoá cookie phía client (kẻ tấn công đã có token vẫn dùng
  // được nếu không có cơ chế thu hồi phía server).
  const token = req.cookies.refreshToken;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      await User.updateOne({ _id: decoded.id }, { $inc: { tokenVersion: 1 } });
    } catch (err) {
      // Token đã hết hạn/không hợp lệ — không cần thu hồi thêm, chỉ xoá cookie
    }
  }

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.status(200).json({ message: 'Đăng xuất thành công' });
};

// 9. FORGOT PASSWORD — yêu cầu gửi mã OTP đặt lại mật khẩu về Gmail
// Chỉ áp dụng cho tài khoản Cán bộ (có email) — Chiến sĩ đăng nhập bằng
// username không có email nên phải liên hệ quản trị viên để được đặt lại.
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Vui lòng nhập email' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // Luôn trả về cùng một thông điệp bất kể email có tồn tại hay không, để
    // không lộ thông tin email nào đã đăng ký trên hệ thống (chống dò quét
    // tài khoản - user enumeration).
    const genericMessage = 'Nếu email của đồng chí tồn tại trên hệ thống, mã OTP đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư.';

    if (!user) {
      return res.status(200).json({ message: genericMessage });
    }

    const otpCode = generateOtp();
    user.passwordResetCode = otpCode;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
    await user.save();

    await sendPasswordResetOTPEmail(user.email, otpCode);

    res.status(200).json({ message: genericMessage });
  } catch (error) {
    console.error('Lỗi yêu cầu đặt lại mật khẩu:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi xử lý yêu cầu đặt lại mật khẩu' });
  }
};

// 10. RESET PASSWORD — xác thực mã OTP và đặt mật khẩu mới
export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !user.passwordResetCode) {
      return res.status(400).json({ message: 'Yêu cầu đặt lại mật khẩu không hợp lệ hoặc đã hết hạn' });
    }

    if (user.passwordResetCode !== code || Date.now() > new Date(user.passwordResetExpires).getTime()) {
      return res.status(400).json({ message: 'Mã OTP không chính xác hoặc đã hết hạn' });
    }

    user.password = newPassword;
    user.passwordResetCode = '';
    user.passwordResetExpires = null;
    // Thu hồi mọi phiên đăng nhập cũ — phòng trường hợp mật khẩu bị lộ chính
    // là lý do đồng chí phải đặt lại mật khẩu.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.status(200).json({ message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.' });
  } catch (error) {
    console.error('Lỗi đặt lại mật khẩu:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi đặt lại mật khẩu' });
  }
};
