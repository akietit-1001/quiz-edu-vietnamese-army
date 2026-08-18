import Unit from '../models/Unit.js';
import User from '../models/User.js';
import { isUnitDescendantOf, getUnitAndDescendantIds } from '../utils/unitHierarchy.js';

// Danh sách toàn bộ cây đơn vị — không cần đăng nhập, dùng cho dropdown ở
// trang Đăng ký. Chỉ trả các field không nhạy cảm. Có kèm `positions` để
// trang Đăng ký lọc đúng chức vụ theo đơn vị đang chọn (giống UserManagement).
export const getPublicUnitTree = async (req, res) => {
  try {
    const units = await Unit.find().select('name level parentId positions order').sort({ level: 1, order: 1, name: 1 });
    res.status(200).json(units);
  } catch (error) {
    console.error('Lỗi lấy cây đơn vị (public):', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách đơn vị' });
  }
};

// Danh sách toàn bộ cây đơn vị — cần đăng nhập, mọi role đều xem được.
// Có kèm `positions` để form thêm/sửa quân nhân lọc đúng chức vụ theo đơn vị.
export const getUnitTree = async (req, res) => {
  try {
    const units = await Unit.find().select('name level parentId positions order').sort({ level: 1, order: 1, name: 1 });
    res.status(200).json(units);
  } catch (error) {
    console.error('Lỗi lấy cây đơn vị:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách đơn vị' });
  }
};

// Tên đơn vị cấp trên trực tiếp (1 bậc) của người đang đăng nhập — dùng làm
// giá trị mặc định cho "Đơn vị cấp trên" khi xuất văn bản (VPAExportPopup).
export const getMyParentUnit = async (req, res) => {
  try {
    const parentId = req.user.unitId?.parentId;
    if (!parentId) {
      return res.status(200).json({ name: null });
    }
    const parent = await Unit.findById(parentId).select('name');
    res.status(200).json({ name: parent?.name || null });
  } catch (error) {
    console.error('Lỗi lấy đơn vị cấp trên:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy đơn vị cấp trên' });
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
      const unit = await Unit.create({ name: name.trim(), level: 1, parentId: null, order: 0 });
      return res.status(201).json(unit);
    }

    const parent = await Unit.findById(parentId);
    if (!parent) {
      return res.status(404).json({ message: 'Không tìm thấy đơn vị cấp cha' });
    }
    if (currentUser.role !== 'master-admin') {
      const allowed = await isUnitDescendantOf(parent._id, currentUser.unitId?._id || currentUser.unitId);
      if (!allowed) {
        return res.status(403).json({ message: 'Bạn không có quyền thêm đơn vị con vào đây' });
      }
    }

    // Đơn vị mới luôn thêm vào CUỐI danh sách con hiện có (order lớn nhất + 1).
    const lastSibling = await Unit.findOne({ parentId: parent._id }).sort({ order: -1 });
    const nextOrder = lastSibling ? lastSibling.order + 1 : 0;

    const unit = await Unit.create({ name: name.trim(), level: parent.level + 1, parentId: parent._id, order: nextOrder });
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

// Xoá đơn vị. Mặc định: từ chối nếu còn đơn vị con hoặc còn user thuộc đơn vị
// này. Với ?cascade=true: xoá luôn toàn bộ cây con — nhưng vẫn từ chối nếu
// BẤT KỲ đơn vị nào trong cây con (kể cả chính nó) còn quân nhân, vì xoá
// không tự động gỡ/chuyển quân nhân.
export const deleteUnit = async (req, res) => {
  try {
    const currentUser = req.user;
    const cascade = req.query.cascade === 'true';
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

    if (!cascade) {
      const hasChildren = await Unit.exists({ parentId: unit._id });
      if (hasChildren) {
        return res.status(400).json({ message: 'Đơn vị còn đơn vị con, không thể xoá' });
      }

      const hasUsers = await User.exists({ unitId: unit._id });
      if (hasUsers) {
        return res.status(400).json({ message: 'Đơn vị còn quân nhân trực thuộc, không thể xoá' });
      }

      await unit.deleteOne();
      return res.status(200).json({ message: 'Đã xoá đơn vị' });
    }

    const subtreeIds = await getUnitAndDescendantIds(unit._id);
    const usersInSubtree = await User.countDocuments({ unitId: { $in: subtreeIds } });
    if (usersInSubtree > 0) {
      return res.status(400).json({
        message: `Cây đơn vị này còn ${usersInSubtree} quân nhân trực thuộc (kể cả đơn vị con), không thể xoá`
      });
    }

    await Unit.deleteMany({ _id: { $in: subtreeIds } });
    res.status(200).json({ message: `Đã xoá đơn vị và ${subtreeIds.length - 1} đơn vị con` });
  } catch (error) {
    console.error('Lỗi xoá đơn vị:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi xoá đơn vị' });
  }
};

// Di chuyển đơn vị sang 1 đơn vị cha khác — tính lại `level` cho chính nó
// và toàn bộ cây con (vì level luôn = parent.level + 1, không phụ thuộc
// client). Chặn di chuyển vào chính nó hoặc vào hậu duệ của nó (tránh vòng lặp).
export const moveUnit = async (req, res) => {
  try {
    const currentUser = req.user;
    const { newParentId } = req.body;

    if (!newParentId) {
      return res.status(400).json({ message: 'Thiếu đơn vị cha mới' });
    }

    const unit = await Unit.findById(req.params.id);
    if (!unit) {
      return res.status(404).json({ message: 'Không tìm thấy đơn vị' });
    }
    if (!unit.parentId) {
      return res.status(400).json({ message: 'Không thể di chuyển đơn vị gốc' });
    }

    const newParent = await Unit.findById(newParentId);
    if (!newParent) {
      return res.status(404).json({ message: 'Không tìm thấy đơn vị cha mới' });
    }
    if (String(newParent._id) === String(unit._id)) {
      return res.status(400).json({ message: 'Không thể chọn chính đơn vị này làm cha' });
    }

    const wouldCreateCycle = await isUnitDescendantOf(newParent._id, unit._id);
    if (wouldCreateCycle) {
      return res.status(400).json({ message: 'Không thể di chuyển 1 đơn vị vào chính hậu duệ của nó' });
    }

    if (currentUser.role !== 'master-admin') {
      const currentUnitId = currentUser.unitId?._id || currentUser.unitId;
      const allowedSource = await isUnitDescendantOf(unit._id, currentUnitId);
      const allowedTarget = await isUnitDescendantOf(newParent._id, currentUnitId);
      if (!allowedSource || !allowedTarget) {
        return res.status(403).json({ message: 'Bạn không có quyền di chuyển đơn vị này' });
      }
    }

    const nameClash = await Unit.findOne({ parentId: newParent._id, name: unit.name });
    if (nameClash) {
      return res.status(400).json({ message: 'Đơn vị cha mới đã có đơn vị con cùng tên' });
    }

    const levelDelta = (newParent.level + 1) - unit.level;
    unit.parentId = newParent._id;
    unit.level = newParent.level + 1;
    await unit.save();

    if (levelDelta !== 0) {
      const subtreeIds = await getUnitAndDescendantIds(unit._id);
      const descendantIds = subtreeIds.filter(id => String(id) !== String(unit._id));
      if (descendantIds.length > 0) {
        await Unit.updateMany(
          { _id: { $in: descendantIds } },
          { $inc: { level: levelDelta } }
        );
      }
    }

    res.status(200).json(unit);
  } catch (error) {
    console.error('Lỗi di chuyển đơn vị:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi di chuyển đơn vị' });
  }
};

// Sắp xếp lại thứ tự hiển thị giữa các đơn vị con CÙNG 1 cha (kéo-thả 1 đơn
// vị lên trước/sau 1 đơn vị anh em khác) — khác với moveUnit (đổi cha).
// Đánh lại order tuần tự (0,1,2,...) cho toàn bộ anh em để tránh trôi dần
// theo thời gian.
export const reorderUnit = async (req, res) => {
  try {
    const currentUser = req.user;
    const { targetId, position } = req.body;

    if (!targetId || !['before', 'after'].includes(position)) {
      return res.status(400).json({ message: 'Thiếu targetId hoặc position không hợp lệ (before/after)' });
    }

    const unit = await Unit.findById(req.params.id);
    if (!unit) {
      return res.status(404).json({ message: 'Không tìm thấy đơn vị' });
    }
    const target = await Unit.findById(targetId);
    if (!target) {
      return res.status(404).json({ message: 'Không tìm thấy đơn vị đích' });
    }
    if (String(unit._id) === String(target._id)) {
      return res.status(200).json(unit);
    }
    if (String(unit.parentId) !== String(target.parentId)) {
      return res.status(400).json({ message: 'Chỉ sắp xếp được giữa các đơn vị cùng cấp, cùng đơn vị cha' });
    }

    if (currentUser.role !== 'master-admin') {
      const allowed = await isUnitDescendantOf(unit._id, currentUser.unitId?._id || currentUser.unitId);
      if (!allowed) {
        return res.status(403).json({ message: 'Bạn không có quyền sắp xếp đơn vị này' });
      }
    }

    const siblings = await Unit.find({ parentId: unit.parentId }).sort({ order: 1, name: 1 });
    const withoutDragged = siblings.filter(s => String(s._id) !== String(unit._id));
    const targetIndex = withoutDragged.findIndex(s => String(s._id) === String(target._id));
    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
    withoutDragged.splice(insertIndex, 0, unit);

    await Promise.all(withoutDragged.map((s, idx) =>
      Unit.updateOne({ _id: s._id }, { $set: { order: idx } })
    ));

    const updated = await Unit.findById(unit._id);
    res.status(200).json(updated);
  } catch (error) {
    console.error('Lỗi sắp xếp đơn vị:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi sắp xếp đơn vị' });
  }
};

// Cập nhật danh sách chức vụ hợp lệ của 1 đơn vị.
export const updateUnitPositions = async (req, res) => {
  try {
    const currentUser = req.user;
    const { positions } = req.body;

    if (!Array.isArray(positions)) {
      return res.status(400).json({ message: 'positions phải là mảng chuỗi' });
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

    const cleaned = Array.from(new Set(
      positions.map(p => String(p).trim()).filter(Boolean)
    ));

    unit.positions = cleaned;
    await unit.save();
    res.status(200).json(unit);
  } catch (error) {
    console.error('Lỗi cập nhật chức vụ đơn vị:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật chức vụ đơn vị' });
  }
};
