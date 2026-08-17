import mongoose from 'mongoose';

const unitSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 3
    // 1 = Bộ CHQS (cao nhất), 2 = Phòng/Ban, 3 = Đại đội (cấp lá)
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    default: null
    // null chỉ hợp lệ ở level 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Tên không trùng giữa các đơn vị con cùng cha
unitSchema.index({ parentId: 1, name: 1 }, { unique: true });

export default mongoose.model('Unit', unitSchema);
