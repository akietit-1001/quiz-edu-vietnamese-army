// Danh sách chức vụ hợp lệ theo TỪNG đơn vị cụ thể (khớp tên đơn vị trong
// cây "Quản lý đơn vị"). Khi chọn đơn vị trong form thêm/sửa quân nhân, chỉ
// chức vụ phù hợp với đơn vị đó mới hiện ra — tránh gán nhầm ví dụ "Chủ
// nhiệm Chính trị" cho một quân nhân ở Ban Quân y.
export const POSITIONS_BY_UNIT_NAME: Record<string, string[]> = {
  // ----- Ban Chỉ huy Bộ CHQS tỉnh (Bộ Tư lệnh cấp tỉnh) -----
  'Bộ CHQS tỉnh Đồng Tháp': [
    'Chỉ huy trưởng',
    'Chính ủy',
    'Phó Chỉ huy trưởng kiêm Tham mưu trưởng',
    'Phó Chỉ huy trưởng',
    'Phó Chính ủy'
  ],

  // ----- Phòng Tham mưu -----
  'Ban Tác chiến': ['Trưởng ban', 'Phó trưởng ban', 'Trợ lý tác huấn', 'Trợ lý tác chiến', 'Trợ lý bản đồ'],
  'Ban Quân lực': ['Trưởng ban', 'Trợ lý quân lực', 'Trợ lý động viên', 'Nhân viên thống kê quân số'],
  'Ban Huấn luyện': ['Trưởng ban', 'Trợ lý huấn luyện sĩ quan', 'Trợ lý huấn luyện binh sĩ', 'Trợ lý thể thao'],
  'Ban Dân quân tự vệ': ['Trưởng ban', 'Trợ lý dân quân tự vệ', 'Trợ lý quản lý vũ khí dân quân tự vệ'],
  'Ban Trinh sát': ['Trưởng ban', 'Trợ lý trinh sát', 'Trợ lý quân báo', 'Nhân viên trinh sát kỹ thuật'],
  'Ban Thông tin': ['Trưởng ban', 'Trợ lý thông tin', 'Nhân viên đài vô tuyến', 'Nhân viên tổng đài hữu tuyến'],
  'Ban Cơ yếu': ['Trưởng ban', 'Trợ lý cơ yếu', 'Mã dịch viên', 'Nhân viên bảo mật mật mã'],

  // ----- Phòng Chính trị -----
  'Ban Tuyên huấn': ['Trưởng ban', 'Trợ lý tuyên huấn', 'Trợ lý thi đua - khen thưởng', 'Nhân viên thư viện/truyền thanh'],
  'Ban Tổ chức': ['Trưởng ban', 'Trợ lý tổ chức Đảng', 'Trợ lý quần chúng'],
  'Ban Cán bộ': ['Trưởng ban', 'Trợ lý cán bộ'],
  'Ban Bảo vệ an ninh': ['Trưởng ban', 'Trợ lý bảo vệ an ninh', 'Trợ lý điều tra hình sự quân đội'],
  'Ban Chính sách': ['Trưởng ban', 'Trợ lý chính sách'],

  // ----- Phòng Hậu cần - Kỹ thuật -----
  'Ban Quân nhu': ['Trưởng ban', 'Trợ lý quân nhu', 'Trợ lý lương thực - thực phẩm', 'Nhân viên quản lý bếp ăn'],
  'Ban Quân y': ['Trưởng ban', 'Bác sĩ/Trợ lý quân y', 'Y sĩ', 'Dược sĩ', 'Y tá trưởng', 'Nhân viên dược'],
  'Ban Doanh trại': ['Trưởng ban', 'Trợ lý doanh trại', 'Nhân viên quản lý điện nước', 'Nhân viên nhà đất'],
  'Ban Xăng dầu': ['Trưởng ban', 'Trợ lý xăng dầu', 'Nhân viên thủ kho xăng dầu', 'Kỹ thuật viên cấp phát'],
  'Ban Quân khí': ['Trưởng ban', 'Trợ lý quân khí', 'Nhân viên thống kê quân khí', 'Sĩ quan/Nhân viên kiểm định vũ khí', 'Thủ kho đạn'],
  'Ban Xe - Máy': ['Trưởng ban', 'Trợ lý xe - máy', 'Thợ sửa chữa ô tô', 'Nhân viên kiểm định xe quân sự'],

  // ----- Trung đoàn (chức vụ chỉ huy cấp trung đoàn + toàn bộ chuỗi tiểu
  // đoàn/đại đội/trung đội/chiến sĩ bên dưới, vì không tạo node riêng cho
  // từng tiểu đoàn/đại đội cụ thể — quân nhân gán trực tiếp vào Trung đoàn
  // vẫn chọn được đúng chức vụ thật của mình) -----
  'Trung đoàn Bộ binh 320': [
    'Trung đoàn trưởng', 'Chính ủy Trung đoàn', 'Phó Trung đoàn trưởng', 'Phó Chính ủy Trung đoàn',
    'Tiểu đoàn trưởng', 'Chính trị viên tiểu đoàn', 'Phó Tiểu đoàn trưởng', 'Chính trị viên phó tiểu đoàn',
    'Đại đội trưởng', 'Chính trị viên đại đội', 'Trung đội trưởng', 'Tiểu đội trưởng', 'Chiến sĩ'
  ],
  'Trung đoàn 924': [
    'Trung đoàn trưởng', 'Chính ủy Trung đoàn', 'Phó Trung đoàn trưởng', 'Phó Chính ủy Trung đoàn',
    'Tiểu đoàn trưởng khung huấn luyện', 'Chính trị viên tiểu đoàn huấn luyện',
    'Đại đội trưởng khung huấn luyện', 'Chính trị viên đại đội (khung)',
    'Trung đội trưởng khung', 'Tiểu đội trưởng khung', 'Chiến sĩ mới'
  ],
  'Trung đoàn 43': [
    'Trung đoàn trưởng', 'Chính ủy Trung đoàn', 'Phó Trung đoàn trưởng', 'Phó Chính ủy Trung đoàn',
    'Tiểu đoàn trưởng khung', 'Đại đội trưởng hỏa lực', 'Trung đội trưởng', 'Thủ kho vũ khí niêm cất'
  ],

  // ----- Cơ quan cấp trung đoàn (con của mỗi Trung đoàn) -----
  'Ban Tham mưu': ['Trưởng ban', 'Trợ lý', 'Nhân viên'],
  // Lưu ý: 'Ban Chính trị' và 'Ban Hậu cần - Kỹ thuật' ở đây là BAN cấp
  // trung đoàn (khác PHÒNG Chính trị / PHÒNG Hậu cần - Kỹ thuật cấp tỉnh ở
  // trên — tên phân biệt rõ "Phòng" so với "Ban" nên không trùng khoá).
  'Ban Chính trị': ['Trưởng ban', 'Trợ lý', 'Nhân viên'],
  'Ban Hậu cần - Kỹ thuật': ['Trưởng ban', 'Trợ lý', 'Nhân viên'],

  // ----- 2 Đại đội binh chủng trực thuộc thẳng Bộ Chỉ huy -----
  'Đại đội Thiết giáp': [
    'Đại đội trưởng', 'Chính trị viên Đại đội', 'Phó Đại đội trưởng', 'Chính trị viên phó',
    'Trung đội trưởng thiết giáp', 'Tiểu đội trưởng', 'Lái xe thiết giáp', 'Nhân viên kỹ thuật'
  ],
  'Đại đội Vận tải': [
    'Đại đội trưởng', 'Chính trị viên Đại đội', 'Phó Đại đội trưởng', 'Chính trị viên phó',
    'Trung đội trưởng vận tải', 'Tiểu đội trưởng', 'Lái xe vận tải', 'Nhân viên kỹ thuật'
  ]
};

// "Ban Chỉ huy" là tên dùng CHUNG cho 3 phòng (Tham mưu/Chính trị/Hậu cần -
// Kỹ thuật) nhưng chức vụ đứng đầu mỗi phòng lại khác nhau hoàn toàn — tra
// theo tên đơn vị CHA thay vì chỉ theo tên "Ban Chỉ huy".
export const POSITIONS_BY_BAN_CHI_HUY_PARENT: Record<string, string[]> = {
  'Phòng Tham mưu': ['Trưởng phòng', 'Phó Trưởng phòng'],
  'Phòng Chính trị': ['Chủ nhiệm Chính trị', 'Phó Chủ nhiệm Chính trị'],
  'Phòng Hậu cần - Kỹ thuật': ['Chủ nhiệm Hậu cần - Kỹ thuật', 'Phó Chủ nhiệm Hậu cần - Kỹ thuật']
};

// Chức vụ dùng chung cho MỌI Ban CHQS cấp Huyện/Thành phố (12 đơn vị) — nhận
// diện qua tiền tố tên, không cần liệt kê từng huyện một.
export const HUYEN_THANH_PHO_POSITIONS = [
  'Chỉ huy trưởng',
  'Chính ủy',
  'Phó Chỉ huy trưởng kiêm Tham mưu trưởng',
  'Phó Chỉ huy trưởng',
  'Chính trị viên phó',
  'Trợ lý Tác chiến',
  'Trợ lý Huấn luyện',
  'Trợ lý Quân lực',
  'Trợ lý Dân quân tự vệ',
  'Trợ lý Chính trị',
  'Trợ lý Hậu cần - Kỹ thuật',
  'Trợ lý Trinh sát', // chỉ thực tế có ở huyện biên giới (Hồng Ngự, Tân Hồng), vẫn để chung cho đơn giản
  'Nhân viên Cơ yếu',
  'Nhân viên Văn thư - Bảo mật'
];

// Chức vụ dùng chung cho cấp Xã/Phường/Thị trấn. Thay vì tạo riêng 143 node
// (không có tên cụ thể từng xã), toàn bộ cấp này được GỘP thành 1 đơn vị đại
// diện duy nhất "Ban CHQS cấp xã/phường" (con trực tiếp của Bộ CHQS tỉnh).
// Vẫn giữ khớp theo tiền tố tên bên dưới để dùng được ngay nếu sau này tách
// lại thành từng xã cụ thể.
export const CAP_XA_POSITIONS = [
  'Chỉ huy trưởng Ban CHQS cấp xã',
  'Chính trị viên Ban CHQS cấp xã',
  'Phó Chỉ huy trưởng Ban CHQS cấp xã',
  'Chính trị viên phó Ban CHQS cấp xã',
  'Tiểu đội trưởng Dân quân thường trực',
  'Chiến sĩ Dân quân thường trực',
  'Dân quân cơ động'
];

// Áp dụng cho các đơn vị cấp Đại đội (tên bắt đầu bằng "Đại đội") không có
// trong danh sách riêng ở trên (VD: Đại đội Thông tin 1/2, Trinh sát cơ
// giới 1/2, Công binh 1/2 thuộc Phòng Tham mưu) — mẫu chức vụ chung.
export const GENERIC_DAI_DOI_POSITIONS = [
  'Đại đội trưởng',
  'Chính trị viên đại đội',
  'Phó Đại đội trưởng',
  'Chính trị viên phó đại đội',
  'Trung đội trưởng',
  'Tiểu đội trưởng',
  'Chiến sĩ'
];

// Danh sách gốc dùng làm phương án dự phòng cho các đơn vị chưa có trong
// các bảng trên (đơn vị mới thêm sau này, hoặc đơn vị không khớp tên nào).
export const FALLBACK_POSITIONS = [
  'Chiến sĩ', 'Tiểu đội trưởng', 'Phó Trung đội trưởng', 'Trung đội trưởng',
  'Phó Đại đội trưởng', 'Đại đội trưởng', 'Phó Tiểu đoàn trưởng', 'Tiểu đoàn trưởng',
  'Chính trị viên', 'Chính trị viên phó', 'Y tá', 'Học viên', 'Giảng viên', 'Khác'
];

/**
 * Trả về danh sách chức vụ hợp lệ cho 1 đơn vị cụ thể.
 * @param unitName Tên đơn vị đang được chọn trong form.
 * @param parentUnitName Tên đơn vị cha (chỉ cần khi unitName === "Ban Chỉ huy").
 */
export function getPositionsForUnit(unitName?: string | null, parentUnitName?: string | null): string[] {
  if (!unitName) return FALLBACK_POSITIONS;

  if (unitName === 'Ban Chỉ huy' && parentUnitName && POSITIONS_BY_BAN_CHI_HUY_PARENT[parentUnitName]) {
    return POSITIONS_BY_BAN_CHI_HUY_PARENT[parentUnitName];
  }

  if (POSITIONS_BY_UNIT_NAME[unitName]) {
    return POSITIONS_BY_UNIT_NAME[unitName];
  }

  if (unitName.startsWith('Ban Chỉ huy Quân sự Huyện') || unitName.startsWith('Ban Chỉ huy Quân sự Thành phố')) {
    return HUYEN_THANH_PHO_POSITIONS;
  }

  if (
    unitName === 'Ban CHQS cấp xã/phường' ||
    unitName.startsWith('Ban Chỉ huy Quân sự Xã') ||
    unitName.startsWith('Ban Chỉ huy Quân sự Phường') ||
    unitName.startsWith('Ban Chỉ huy Quân sự Thị trấn')
  ) {
    return CAP_XA_POSITIONS;
  }

  if (unitName.startsWith('Đại đội')) {
    return GENERIC_DAI_DOI_POSITIONS;
  }

  return FALLBACK_POSITIONS;
}

// Hợp nhất toàn bộ chức vụ có thể có — dùng cho các nơi cần lọc/tìm kiếm
// theo chức vụ trên TOÀN hệ thống (không gắn với 1 đơn vị cụ thể), ví dụ ô
// "Bộ lọc nâng cao" của bảng danh sách quân nhân.
export const ALL_POSITIONS: string[] = Array.from(new Set([
  ...FALLBACK_POSITIONS,
  ...GENERIC_DAI_DOI_POSITIONS,
  ...HUYEN_THANH_PHO_POSITIONS,
  ...CAP_XA_POSITIONS,
  ...Object.values(POSITIONS_BY_UNIT_NAME).flat(),
  ...Object.values(POSITIONS_BY_BAN_CHI_HUY_PARENT).flat()
])).sort();
