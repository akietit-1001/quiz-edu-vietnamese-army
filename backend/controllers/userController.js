import User from '../models/User.js';
import { isUnitDescendantOf } from '../utils/unitHierarchy.js';
import { isDescendantInChain, getManagedDescendantIds, reassignDirectReportsOnDelete } from '../utils/commandChain.js';

// 1. GET ALL USERS (Filtered based on role + chuỗi chỉ huy managedBy)
export const getUsers = async (req, res) => {
  try {
    const currentUser = req.user;
    let query = {};

    if (currentUser.role === 'admin') {
      const managedIds = await getManagedDescendantIds(currentUser._id);
      query = {
        role: { $in: ['sub-admin', 'user'] },
        _id: { $in: managedIds }
      };
    } else if (currentUser.role === 'sub-admin') {
      const managedIds = await getManagedDescendantIds(currentUser._id);
      query = {
        role: 'user',
        _id: { $in: managedIds }
      };
    }
    // master-admin can see all users (no filters)

    const users = await User.find(query).select('-password').populate('unitId', 'name level');
    const formatted = users.map(u => {
      const obj = u.toObject();
      obj.unit = obj.unitId ? { id: obj.unitId._id, name: obj.unitId.name, level: obj.unitId.level } : null;
      delete obj.unitId;
      return obj;
    });
    res.status(200).json(formatted);
  } catch (error) {
    console.error('Lỗi lấy danh sách người dùng:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách người dùng' });
  }
};

// 2. CREATE USER
export const createUser = async (req, res) => {
  try {
    const { personnelType, email, username, password, fullName, dateOfBirth, rank, position, unitId, address, role } = req.body;
    const currentUser = req.user;

    if (!unitId) {
      return res.status(400).json({ message: 'Vui lòng chọn đơn vị công tác' });
    }

    let normalizedUsername;
    if (personnelType === 'soldier') {
      if (!username || !username.trim()) {
        return res.status(400).json({ message: 'Vui lòng nhập tên đăng nhập' });
      }
      normalizedUsername = username.trim().toLowerCase();
      const usernameExists = await User.findOne({ username: normalizedUsername });
      if (usernameExists) {
        return res.status(400).json({ message: 'Tên đăng nhập này đã tồn tại trên hệ thống' });
      }
    } else {
      if (!email) {
        return res.status(400).json({ message: 'Vui lòng nhập email' });
      }
      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({ message: 'Email này đã tồn tại trên hệ thống' });
      }
    }

    // Role and unit restrictions
    let finalRole = role || 'user';
    if (currentUser.role !== 'master-admin') {
      // Đơn vị mới phải nằm trong (hoặc bằng) nhánh đơn vị của người tạo
      const allowedUnit = await isUnitDescendantOf(unitId, currentUser.unitId?._id || currentUser.unitId);
      if (!allowedUnit) {
        return res.status(403).json({ message: 'Đồng chí chỉ có thể tạo người dùng trong đơn vị thuộc quyền' });
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
      personnelType: personnelType === 'soldier' ? 'soldier' : 'officer',
      email: personnelType === 'soldier' ? undefined : email,
      username: personnelType === 'soldier' ? normalizedUsername : undefined,
      password,
      fullName,
      dateOfBirth,
      rank,
      position,
      unitId,
      address,
      role: finalRole,
      managedBy: currentUser._id
    });

    await newUser.populate('unitId', 'name level');

    res.status(201).json({
      message: 'Tạo tài khoản người dùng thành công',
      user: {
        id: newUser._id,
        email: newUser.email,
        username: newUser.username,
        personnelType: newUser.personnelType,
        fullName: newUser.fullName,
        role: newUser.role,
        unit: newUser.unitId ? { id: newUser.unitId._id, name: newUser.unitId.name, level: newUser.unitId.level } : null,
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
    const { fullName, dateOfBirth, rank, position, unitId, address, role, avatarUrl } = req.body;
    const currentUser = req.user;

    const userToUpdate = await User.findById(id);
    if (!userToUpdate) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng cần chỉnh sửa' });
    }

    // Check permissions
    if (currentUser.role !== 'master-admin') {
      // Người này phải nằm trong chuỗi chỉ huy (cấp dưới) của mình
      const managesTarget = await isDescendantInChain(userToUpdate._id, currentUser._id);
      if (!managesTarget) {
        return res.status(403).json({ message: 'Đồng chí chỉ có thể chỉnh sửa người dùng thuộc quyền quản lý' });
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

    if (unitId) {
      if (currentUser.role === 'master-admin') {
        userToUpdate.unitId = unitId;
      } else {
        // Đơn vị mới phải thuộc nhánh của người đang sửa
        const allowedUnit = await isUnitDescendantOf(unitId, currentUser.unitId?._id || currentUser.unitId);
        if (!allowedUnit) {
          return res.status(403).json({ message: 'Đơn vị mới phải thuộc quyền quản lý của đồng chí' });
        }
        userToUpdate.unitId = unitId;
      }
    }
    if (address) userToUpdate.address = address;
    if (avatarUrl) userToUpdate.avatarUrl = avatarUrl;
    if (role && (currentUser.role === 'master-admin' || currentUser.role === 'admin' || currentUser.role === 'sub-admin')) {
      userToUpdate.role = role; // Already verified hierarchy rules above
    }

    await userToUpdate.save();
    await userToUpdate.populate('unitId', 'name level');

    res.status(200).json({
      message: 'Cập nhật thông tin người dùng thành công',
      user: {
        id: userToUpdate._id,
        email: userToUpdate.email,
        fullName: userToUpdate.fullName,
        role: userToUpdate.role,
        unit: userToUpdate.unitId ? { id: userToUpdate.unitId._id, name: userToUpdate.unitId.name, level: userToUpdate.unitId.level } : null,
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
      const managesTarget = await isDescendantInChain(userToDelete._id, currentUser._id);
      if (!managesTarget) {
        return res.status(403).json({ message: 'Đồng chí chỉ có thể xóa người dùng thuộc quyền quản lý' });
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

    // Cấp dưới trực tiếp của người bị xoá tự động chuyển lên cấp trên kế
    // tiếp, tránh đứt chuỗi chỉ huy
    await reassignDirectReportsOnDelete(userToDelete);

    await User.findByIdAndDelete(id);
    res.status(200).json({ message: 'Đã xóa người dùng khỏi hệ thống thành công' });
  } catch (error) {
    console.error('Lỗi xóa người dùng:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa người dùng' });
  }
};

// 5. UPDATE CURRENT USER PROFILE (SELF)
// Lưu ý: không cho tự đổi đơn vị (unitId) qua đây nữa — việc chuyển đơn vị
// là hành động của cấp quản lý qua updateUser, không phải tự phục vụ.
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, dateOfBirth, rank, position, address, avatarUrl } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    if (fullName) user.fullName = fullName;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (rank) user.rank = rank;
    if (position) user.position = position;
    if (address) user.address = address;
    if (avatarUrl) user.avatarUrl = avatarUrl;

    await user.save();
    await user.populate('unitId', 'name level');

    res.status(200).json({
      message: 'Cập nhật thông tin cá nhân thành công',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        unit: user.unitId ? { id: user.unitId._id, name: user.unitId.name, level: user.unitId.level } : null,
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
    // Thu hồi mọi access/refresh token đã phát hành trước đó (kể cả phiên
    // hiện tại) — bắt buộc đăng nhập lại bằng mật khẩu mới, đúng thông lệ bảo
    // mật khi đổi mật khẩu.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.status(200).json({ message: 'Thay đổi mật khẩu thành công. Vui lòng đăng nhập lại.' });
  } catch (error) {
    console.error('Lỗi đổi mật khẩu:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi thay đổi mật khẩu' });
  }
};
