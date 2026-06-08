import User from '../models/User.js';
import TempUser from '../models/TempUser.js';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { sendRegistrationOTPEmail, send2FAOTPEmail } from '../utils/mailer.js';

// Helper to generate access and refresh tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role, unit: user.unit },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// 1. REGISTER
export const register = async (req, res) => {
  try {
    const { email, password, fullName, dateOfBirth, rank, position, unit, address } = req.body;

    // Check if user exists in permanent database
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Email này đã được đăng ký sử dụng' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create or update record in TempUser
    await TempUser.findOneAndUpdate(
      { email },
      {
        email,
        otpCode,
        expiresAt,
        userData: { email, password, fullName, dateOfBirth, rank, position, unit, address },
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
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
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
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      
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

    // Save refresh token to HTTP-Only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      message: 'Đăng nhập thành công',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        unit: user.unit,
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

    const user = await User.findOne({ email });
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

    // Save refresh to cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      message: 'Đăng nhập 2FA thành công',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        unit: user.unit,
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
    const user = await User.create({
      ...tempUser.userData,
      role
    });

    // Delete the temporary document from TempUser
    await TempUser.deleteOne({ email });

    const { accessToken, refreshToken } = generateTokens(user);

    // Save refresh to cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      message: 'Xác thực tài khoản thành công',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        unit: user.unit,
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

    // We will use Email OTP for 2FA. Send a test OTP code to verify setup
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
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

    const tokens = generateTokens(user);

    res.status(200).json({
      accessToken: tokens.accessToken
    });
  } catch (error) {
    return res.status(401).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
  }
};

// 8. LOGOUT
export const logout = async (req, res) => {
  res.clearCookie('refreshToken');
  res.status(200).json({ message: 'Đăng xuất thành công' });
};
