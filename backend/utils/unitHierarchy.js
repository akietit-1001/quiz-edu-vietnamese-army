import mongoose from 'mongoose';
import Unit from '../models/Unit.js';

/**
 * Trả về true nếu candidateUnitId chính là ancestorUnitId, hoặc là hậu duệ
 * (con/cháu) của ancestorUnitId trong cây đơn vị. Đi ngược parentId cho tới
 * gốc (level 1) — cây không giới hạn số cấp.
 */
export const isUnitDescendantOf = async (candidateUnitId, ancestorUnitId) => {
  if (!candidateUnitId || !ancestorUnitId) return false;
  if (String(candidateUnitId) === String(ancestorUnitId)) return true;

  const unit = await Unit.findById(candidateUnitId).select('parentId');
  if (!unit || !unit.parentId) return false;

  return isUnitDescendantOf(unit.parentId, ancestorUnitId);
};

/**
 * Trả về mảng _id gồm rootUnitId và toàn bộ đơn vị con/cháu của nó
 * (dùng cho truy vấn $in). Dùng $graphLookup vì gọn và không phụ thuộc
 * cứng vào việc cây chỉ có đúng 3 cấp.
 */
export const getUnitAndDescendantIds = async (rootUnitId) => {
  if (!rootUnitId) return [];

  const results = await Unit.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(String(rootUnitId)) } },
    {
      $graphLookup: {
        from: 'units',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parentId',
        as: 'descendants'
      }
    }
  ]);

  if (!results.length) return [rootUnitId];

  return [rootUnitId, ...results[0].descendants.map((d) => d._id)];
};
