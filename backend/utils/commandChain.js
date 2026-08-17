import mongoose from 'mongoose';
import User from '../models/User.js';

/**
 * Trả về true nếu candidateUserId chính là ancestorUserId, hoặc là cấp dưới
 * (trực tiếp/gián tiếp) của ancestorUserId theo chuỗi managedBy.
 */
export const isDescendantInChain = async (candidateUserId, ancestorUserId) => {
  if (!candidateUserId || !ancestorUserId) return false;
  if (String(candidateUserId) === String(ancestorUserId)) return true;

  const user = await User.findById(candidateUserId).select('managedBy');
  if (!user || !user.managedBy) return false;

  return isDescendantInChain(user.managedBy, ancestorUserId);
};

/**
 * Trả về mảng _id gồm rootUserId và toàn bộ cấp dưới (trực tiếp/gián tiếp)
 * của người này theo chuỗi managedBy (dùng cho truy vấn $in).
 */
export const getManagedDescendantIds = async (rootUserId) => {
  if (!rootUserId) return [];

  const results = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(String(rootUserId)) } },
    {
      $graphLookup: {
        from: 'users',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'managedBy',
        as: 'descendants'
      }
    }
  ]);

  if (!results.length) return [rootUserId];

  return [rootUserId, ...results[0].descendants.map((d) => d._id)];
};

/**
 * Danh sách _id các "creator" mà currentUser được phép xem/thao tác dữ liệu
 * do họ tạo ra (dùng cho ngân hàng câu hỏi): chính mình + toàn bộ cấp dưới
 * theo chuỗi managedBy + mọi master-admin (để thấy nội dung dùng chung).
 * Trả về null nếu currentUser là master-admin (không giới hạn).
 */
export const getAllowedCreatorIds = async (currentUser) => {
  if (currentUser.role === 'master-admin') return null;

  const managedIds = await getManagedDescendantIds(currentUser._id);
  const masterAdmins = await User.find({ role: 'master-admin' }).select('_id');

  return [...managedIds, ...masterAdmins.map((u) => u._id)];
};

/**
 * Khi xoá 1 user đang là managedBy của người khác, chuyển cấp dưới của họ
 * lên thẳng cấp trên kế tiếp (managedBy của người vừa bị xoá) để không bị
 * mồ côi trong chuỗi chỉ huy. Gọi hàm này TRƯỚC khi thực sự xoá document.
 */
export const reassignDirectReportsOnDelete = async (deletedUser) => {
  await User.updateMany(
    { managedBy: deletedUser._id },
    { managedBy: deletedUser.managedBy || null }
  );
};
