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
  positions: {
    type: [String],
    default: []
    // Danh sách chức vụ hợp lệ CỦA RIÊNG đơn vị này — quyết định chức vụ nào
    // hiện ra khi chọn đơn vị này trong form thêm/sửa quân nhân. Quản lý qua
    // UI (không còn suy theo tên/tiền tố đơn vị như trước).
  },
  order: {
    type: Number,
    default: 0
    // Thứ tự hiển thị giữa các đơn vị con CÙNG 1 cha — số nhỏ hơn hiện
    // trước. Mặc định 0 cho mọi đơn vị (kể cả cũ) nên khi chưa ai kéo-thả
    // sắp xếp thủ công, thứ tự vẫn rơi về so sánh phụ (xem unitSort.ts ở
    // frontend: "Ban Chỉ huy" trước, còn lại theo alphabet).
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Tên không trùng giữa các đơn vị con cùng cha
unitSchema.index({ parentId: 1, name: 1 }, { unique: true });

export default mongoose.model('Unit', unitSchema);
