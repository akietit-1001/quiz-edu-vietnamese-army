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
    min: 1
    // 1 = Bộ CHQS (cao nhất), 2 = Phòng/Ban/Trung đoàn/Ban CHQS huyện, 3+ =
    // các cấp con sâu hơn (Ban trực thuộc phòng, cơ quan trung đoàn, đại
    // đội...). Không còn giới hạn cấp tối đa — cây đơn vị thực tế có thể sâu
    // hơn 3 cấp (VD: Trung đoàn → Tiểu đoàn → Đại đội).
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
