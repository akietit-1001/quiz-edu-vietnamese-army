import User from '../models/User.js';

// Helper to escape regex special characters
const escapeRegex = (string) => {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

// 1. GET ALL USERS (Filtered based on role)
export const getUsers = async (req, res) => {
  try {
    const currentUser = req.user;
    let query = {};

    // If admin, they can only see users they manage or users in the same unit
    if (currentUser.role === 'admin') {
      const escapedUnit = escapeRegex(currentUser.unit);
      query = {
        $and: [
          { role: { $in: ['sub-admin', 'user'] } },
          { $or: [{ unit: { $regex: escapedUnit, $options: 'i' } }, { managedBy: currentUser._id }] }
        ]
      };
    } else if (currentUser.role === 'sub-admin') {
      // Sub-admins can see users in the same unit who are below their level (i.e. 'user')
      const escapedUnit = escapeRegex(currentUser.unit);
      query = {
        $and: [
          { role: 'user' },
          { unit: { $regex: escapedUnit, $options: 'i' } }
        ]
      };
    }
    // master-admin can see all users (no filters)

    const users = await User.find(query).select('-password');
    res.status(200).json(users);
  } catch (error) {
    console.error('Lỗi lấy danh sách người dùng:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách người dùng' });
  }
};

// 2. CREATE USER
export const createUser = async (req, res) => {
  try {
    const { email, password, fullName, dateOfBirth, rank, position, unit, address, role } = req.body;
    const currentUser = req.user;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Email này đã tồn tại trên hệ thống' });
    }

    // Role and unit restrictions
    let finalRole = role || 'user';
    if (currentUser.role !== 'master-admin') {
      // Unit verification (must be same or subordinate unit)
      if (!unit.toLowerCase().includes(currentUser.unit.toLowerCase())) {
        return res.status(403).json({ message: 'Đồng chí chỉ có thể tạo người dùng trong cùng hoặc đơn vị thuộc quyền' });
      }

      // Hierarchy verification
      if (currentUser.role === 'admin') {
        if (finalRole !== 'sub-admin' && finalRole !== 'user') {
          return res.status(403).json({ message: 'Đồng chí không thể tạo người dùng có quyền bằng hoặc cao hơn mình' });
        }
      } else if (currentUser.role === 'sub-admin') {
        if (finalRole !== 'user') {
          return res.status(403).json({ message: 'Đồng chí chỉ có thể tạo người dùng có quyền chiến sĩ (User)' });
        }
      } else {
        return res.status(403).json({ message: 'Đồng chí không có quyền tạo người dùng' });
      }
    }

    const newUser = await User.create({
      email,
      password,
      fullName,
      dateOfBirth,
      rank,
      position,
      unit,
      address,
      role: finalRole,
      managedBy: currentUser._id
    });

    res.status(201).json({
      message: 'Tạo tài khoản người dùng thành công',
      user: {
        id: newUser._id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        unit: newUser.unit,
        rank: newUser.rank,
        position: newUser.position
      }
    });
  } catch (error) {
    console.error('Lỗi tạo người dùng:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi tạo người dùng' });
  }
};

// 3. UPDATE USER
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, dateOfBirth, rank, position, unit, address, role, avatarUrl } = req.body;
    const currentUser = req.user;

    const userToUpdate = await User.findById(id);
    if (!userToUpdate) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng cần chỉnh sửa' });
    }

    // Check permissions
    if (currentUser.role !== 'master-admin') {
      // Must be same or subordinate unit
      if (!userToUpdate.unit.toLowerCase().includes(currentUser.unit.toLowerCase())) {
        return res.status(403).json({ message: 'Đồng chí chỉ có thể chỉnh sửa người dùng trong cùng hoặc đơn vị thuộc quyền' });
      }

      // Check role level hierarchy
      if (currentUser.role === 'admin') {
        if (userToUpdate.role === 'admin' || userToUpdate.role === 'master-admin') {
          return res.status(403).json({ message: 'Đồng chí không có quyền chỉnh sửa quản trị viên cấp bằng hoặc cao hơn' });
        }
        if (role && role !== 'sub-admin' && role !== 'user') {
          return res.status(403).json({ message: 'Đồng chí không thể phân quyền bằng hoặc cao hơn quyền của mình' });
        }
      } else if (currentUser.role === 'sub-admin') {
        if (userToUpdate.role !== 'user') {
          return res.status(403).json({ message: 'Đồng chí chỉ có quyền chỉnh sửa tài khoản cấp dưới (User)' });
        }
        if (role && role !== 'user') {
          return res.status(403).json({ message: 'Đồng chí không thể phân quyền bằng hoặc cao hơn quyền của mình' });
        }
      } else {
        return res.status(403).json({ message: 'Đồng chí không có quyền chỉnh sửa người dùng' });
      }
    }

    // Update fields
    if (fullName) userToUpdate.fullName = fullName;
    if (dateOfBirth) userToUpdate.dateOfBirth = dateOfBirth;
    if (rank) userToUpdate.rank = rank;
    if (position) userToUpdate.position = position;
    
    if (unit) {
      if (currentUser.role === 'master-admin') {
        userToUpdate.unit = unit;
      } else {
        // Must contain commander's unit
        if (!unit.toLowerCase().includes(currentUser.unit.toLowerCase())) {
          return res.status(403).json({ message: 'Đơn vị mới phải thuộc quyền quản lý của đồng chí' });
        }
        userToUpdate.unit = unit;
      }
    }
    if (address) userToUpdate.address = address;
    if (avatarUrl) userToUpdate.avatarUrl = avatarUrl;
    if (role && (currentUser.role === 'master-admin' || currentUser.role === 'admin' || currentUser.role === 'sub-admin')) {
      userToUpdate.role = role; // Already verified hierarchy rules above
    }

    await userToUpdate.save();

    res.status(200).json({
      message: 'Cập nhật thông tin người dùng thành công',
      user: {
        id: userToUpdate._id,
        email: userToUpdate.email,
        fullName: userToUpdate.fullName,
        role: userToUpdate.role,
        unit: userToUpdate.unit,
        rank: userToUpdate.rank,
        position: userToUpdate.position
      }
    });
  } catch (error) {
    console.error('Lỗi cập nhật người dùng:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật thông tin người dùng' });
  }
};

// 4. DELETE USER
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const userToDelete = await User.findById(id);
    if (!userToDelete) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng cần xóa' });
    }

    // Permission checks
    if (currentUser.role !== 'master-admin') {
      // Must be same or subordinate unit
      if (!userToDelete.unit.toLowerCase().includes(currentUser.unit.toLowerCase())) {
        return res.status(403).json({ message: 'Đồng chí chỉ có thể xóa người dùng trong cùng hoặc đơn vị thuộc quyền' });
      }

      // Check role level hierarchy
      if (currentUser.role === 'admin') {
        if (userToDelete.role === 'admin' || userToDelete.role === 'master-admin') {
          return res.status(403).json({ message: 'Đồng chí không có quyền xóa quản trị viên cấp bằng hoặc cao hơn' });
        }
      } else if (currentUser.role === 'sub-admin') {
        if (userToDelete.role !== 'user') {
          return res.status(403).json({ message: 'Đồng chí chỉ có quyền xóa tài khoản cấp dưới (User)' });
        }
      } else {
        return res.status(403).json({ message: 'Đồng chí không có quyền xóa người dùng' });
      }
    }

    await User.findByIdAndDelete(id);
    res.status(200).json({ message: 'Đã xóa người dùng khỏi hệ thống thành công' });
  } catch (error) {
    console.error('Lỗi xóa người dùng:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa người dùng' });
  }
};

// 5. UPDATE CURRENT USER PROFILE (SELF)
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, dateOfBirth, rank, position, unit, address, avatarUrl } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    if (fullName) user.fullName = fullName;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (rank) user.rank = rank;
    if (position) user.position = position;
    if (unit) user.unit = unit;
    if (address) user.address = address;
    if (avatarUrl) user.avatarUrl = avatarUrl;

    await user.save();

    res.status(200).json({
      message: 'Cập nhật thông tin cá nhân thành công',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        unit: user.unit,
        rank: user.rank,
        position: user.position,
        dateOfBirth: user.dateOfBirth,
        address: user.address,
        avatarUrl: user.avatarUrl,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  } catch (error) {
    console.error('Lỗi tự cập nhật hồ sơ:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật thông tin cá nhân' });
  }
};

// 6. CHANGE PASSWORD (SELF)
export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Compare with current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không chính xác' });
    }

    // Set new password (which will be automatically hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: 'Thay đổi mật khẩu thành công' });
  } catch (error) {
    console.error('Lỗi đổi mật khẩu:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi thay đổi mật khẩu' });
  }
};
