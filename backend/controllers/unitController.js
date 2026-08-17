import Unit from '../models/Unit.js';
import User from '../models/User.js';
import { isUnitDescendantOf } from '../utils/unitHierarchy.js';

// Danh sách toàn bộ cây đơn vị — không cần đăng nhập, dùng cho dropdown ở
// trang Đăng ký. Chỉ trả các field không nhạy cảm.
export const getPublicUnitTree = async (req, res) => {
  try {
    const units = await Unit.find().select('name level parentId').sort({ level: 1, name: 1 });
    res.status(200).json(units);
  } catch (error) {
    console.error('Lỗi lấy cây đơn vị (public):', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách đơn vị' });
  }
};

// Danh sách toàn bộ cây đơn vị — cần đăng nhập, mọi role đều xem được.
export const getUnitTree = async (req, res) => {
  try {
    const units = await Unit.find().select('name level parentId').sort({ level: 1, name: 1 });
    res.status(200).json(units);
  } catch (error) {
    console.error('Lỗi lấy cây đơn vị:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách đơn vị' });
  }
};

// Tạo đơn vị con mới. master-admin tạo được ở bất kỳ đâu (kể cả root nếu
// chưa có). admin/sub-admin chỉ tạo được đơn vị con nằm trong nhánh mình
// quản lý (unitId của chính họ hoặc hậu duệ của nó).
export const createUnit = async (req, res) => {
  try {
    const { name, parentId } = req.body;
    const currentUser = req.user;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Tên đơn vị không được để trống' });
    }

    // Tạo đơn vị gốc (level 1, không có cha)
    if (!parentId) {
      if (currentUser.role !== 'master-admin') {
        return res.status(403).json({ message: 'Chỉ master-admin được tạo đơn vị cấp cao nhất' });
      }
      const existingRoot = await Unit.countDocuments({ level: 1 });
      if (existingRoot > 0) {
        return res.status(400).json({ message: 'Đã tồn tại đơn vị cấp cao nhất, không thể tạo thêm' });
      }
      const unit = await Unit.create({ name: name.trim(), level: 1, parentId: null });
      return res.status(201).json(unit);
    }

    const parent = await Unit.findById(parentId);
    if (!parent) {
      return res.status(404).json({ message: 'Không tìm thấy đơn vị cấp cha' });
    }
    if (parent.level >= 3) {
      return res.status(400).json({ message: 'Đại đội (cấp 3) không thể có đơn vị con' });
    }

    if (currentUser.role !== 'master-admin') {
      const allowed = await isUnitDescendantOf(parent._id, currentUser.unitId?._id || currentUser.unitId);
      if (!allowed) {
        return res.status(403).json({ message: 'Bạn không có quyền thêm đơn vị con vào đây' });
      }
    }

    const unit = await Unit.create({ name: name.trim(), level: parent.level + 1, parentId: parent._id });
    res.status(201).json(unit);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Đã tồn tại đơn vị cùng tên trong đơn vị cha này' });
    }
    console.error('Lỗi tạo đơn vị:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi tạo đơn vị' });
  }
};

// Đổi tên đơn vị (không đổi cấp cha).
export const renameUnit = async (req, res) => {
  try {
    const { name } = req.body;
    const currentUser = req.user;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Tên đơn vị không được để trống' });
    }

    const unit = await Unit.findById(req.params.id);
    if (!unit) {
      return res.status(404).json({ message: 'Không tìm thấy đơn vị' });
    }

    if (currentUser.role !== 'master-admin') {
      const allowed = await isUnitDescendantOf(unit._id, currentUser.unitId?._id || currentUser.unitId);
      if (!allowed) {
        return res.status(403).json({ message: 'Bạn không có quyền sửa đơn vị này' });
      }
    }

    unit.name = name.trim();
    await unit.save();
    res.status(200).json(unit);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Đã tồn tại đơn vị cùng tên trong đơn vị cha này' });
    }
    console.error('Lỗi đổi tên đơn vị:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi đổi tên đơn vị' });
  }
};

// Xoá đơn vị — từ chối nếu còn đơn vị con hoặc còn user thuộc đơn vị này.
export const deleteUnit = async (req, res) => {
  try {
    const currentUser = req.user;
    const unit = await Unit.findById(req.params.id);
    if (!unit) {
      return res.status(404).json({ message: 'Không tìm thấy đơn vị' });
    }

    if (currentUser.role !== 'master-admin') {
      const allowed = await isUnitDescendantOf(unit._id, currentUser.unitId?._id || currentUser.unitId);
      if (!allowed) {
        return res.status(403).json({ message: 'Bạn không có quyền xoá đơn vị này' });
      }
    }

    const hasChildren = await Unit.exists({ parentId: unit._id });
    if (hasChildren) {
      return res.status(400).json({ message: 'Đơn vị còn đơn vị con, không thể xoá' });
    }

    const hasUsers = await User.exists({ unitId: unit._id });
    if (hasUsers) {
      return res.status(400).json({ message: 'Đơn vị còn quân nhân trực thuộc, không thể xoá' });
    }

    await unit.deleteOne();
    res.status(200).json({ message: 'Đã xoá đơn vị' });
  } catch (error) {
    console.error('Lỗi xoá đơn vị:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi xoá đơn vị' });
  }
};
