const fs = require('fs');
const path = require('path');

const userIds = [
  "d882f80d3dc76716f2ab6881", // Nguyễn Văn Quyết (master-admin)
  "338dc62fb8588d5df86c1374", // Võ Xuân Phong (admin)
  "6861e6b25e49f729dee2225b"  // Vũ Quốc Khải (admin)
];

const getRandomCreator = () => {
  return { "$oid": userIds[Math.floor(Math.random() * userIds.length)] };
};

const questionsPool = [
  // === CHÍNH TRỊ (15 câu) ===
  {
    questionType: "multiple-choice",
    questionText: "Đảng Cộng sản Việt Nam được thành lập vào ngày, tháng, năm nào?",
    options: ["Ngày 03/02/1930", "Ngày 19/05/1930", "Ngày 02/09/1945", "Ngày 22/12/1944"],
    correctAnswers: ["0"],
    explanation: "Đảng Cộng sản Việt Nam được thành lập ngày 3 tháng 2 năm 1930 tại Hội nghị hợp nhất các tổ chức cộng sản họp ở Cửu Long, Hương Cảng, Trung Quốc.",
    category: "Chính trị",
    difficulty: "Dễ"
  },
  {
    questionType: "multiple-choice",
    questionText: "Cơ quan nào thực hiện sự lãnh đạo tuyệt đối, trực tiếp về mọi mặt của Đảng đối với Quân đội nhân dân Việt Nam?",
    options: ["Bộ Quốc phòng", "Tổng cục Chính trị", "Ban Chấp hành Trung ương Đảng, trực tiếp là Bộ Chính trị", "Quân ủy Trung ương"],
    correctAnswers: ["2"],
    explanation: "Đảng Cộng sản Việt Nam lãnh đạo tuyệt đối, trực tiếp về mọi mặt đối với Quân đội nhân dân Việt Nam thông qua Ban Chấp hành Trung ương, Bộ Chính trị.",
    category: "Chính trị",
    difficulty: "Trung bình"
  },
  {
    questionType: "multiple-choice",
    questionText: "Nội dung cơ bản của tư tưởng Hồ Chí Minh về đường lối quân sự là gì?",
    options: ["Chiến tranh nhân dân, toàn dân, toàn diện", "Chiến tranh chớp nhoáng, hiện đại", "Chiến tranh du kích đơn thuần", "Chiến tranh ủy nhiệm"],
    correctAnswers: ["0"],
    explanation: "Đường lối quân sự của tư tưởng Hồ Chí Minh là tiến hành chiến tranh nhân dân, toàn dân đánh giặc, toàn diện trên các mặt trận.",
    category: "Chính trị",
    difficulty: "Trung bình"
  },
  {
    questionType: "multiple-choice",
    questionText: "Nguồn gốc bản chất cách mạng của Quân đội nhân dân Việt Nam bắt nguồn từ đâu?",
    options: ["Từ truyền thống đánh giặc ngoại xâm của dân tộc", "Từ sự lãnh đạo của Đảng Cộng sản Việt Nam và Chủ tịch Hồ Chí Minh", "Từ sự giúp đỡ của bạn bè quốc tế", "Từ quá trình huấn luyện chiến đấu lâu dài"],
    correctAnswers: ["1"],
    explanation: "Bản chất cách mạng của quân đội bắt nguồn từ sự lãnh đạo của Đảng và Chủ tịch Hồ Chí Minh, mang bản chất của giai cấp công nhân.",
    category: "Chính trị",
    difficulty: "Trung bình"
  },
  {
    questionType: "multiple-choice",
    questionText: "Nhiệm vụ hàng đầu của Quân đội nhân dân Việt Nam trong giai đoạn hiện nay là gì?",
    options: ["Xây dựng kinh tế đất nước", "Bảo vệ vững chắc độc lập, chủ quyền, thống nhất, toàn vẹn lãnh thổ của Tổ quốc", "Tham gia các hoạt động gìn giữ hòa bình liên hợp quốc", "Huấn luyện và diễn tập"],
    correctAnswers: ["1"],
    explanation: "Nhiệm vụ hàng đầu của quân đội luôn là bảo vệ vững chắc độc lập, chủ quyền và toàn vẹn lãnh thổ quốc gia.",
    category: "Chính trị",
    difficulty: "Dễ"
  },
  {
    questionType: "true-false",
    questionText: "Quân đội nhân dân Việt Nam mang bản chất của giai cấp công nhân, có tính nhân dân và tính dân tộc sâu sắc.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Đây là nguyên tắc xây dựng quân đội kiểu mới của Đảng ta và Chủ tịch Hồ Chí Minh.",
    category: "Chính trị",
    difficulty: "Dễ"
  },
  {
    questionType: "true-false",
    questionText: "Chức năng của Quân đội nhân dân Việt Nam chỉ bao gồm chiến đấu, ngoài ra không có chức năng nào khác.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["1"],
    explanation: "Quân đội có 3 chức năng lớn: Đội quân chiến đấu, đội quân công tác và đội quân lao động sản xuất.",
    category: "Chính trị",
    difficulty: "Dễ"
  },
  {
    questionType: "true-false",
    questionText: "Học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh là nhiệm vụ thường xuyên của mỗi cán bộ, chiến sĩ.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Đây là cuộc vận động lớn mang tính chất liên tục, thường xuyên trong toàn quân.",
    category: "Chính trị",
    difficulty: "Dễ"
  },
  {
    questionType: "true-false",
    questionText: "Quân ủy Trung ương do Bộ trưởng Bộ Quốc phòng làm Bí thư.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["1"],
    explanation: "Bí thư Quân ủy Trung ương là Tổng Bí thư Ban Chấp hành Trung ương Đảng Cộng sản Việt Nam.",
    category: "Chính trị",
    difficulty: "Khó"
  },
  {
    questionType: "true-false",
    questionText: "Hiến pháp nước Cộng hòa xã hội chủ nghĩa Việt Nam quy định lực lượng vũ trang nhân dân phải tuyệt đối trung thành với Tổ quốc, Nhân dân, với Đảng và Nhà nước.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Đây là quy định hiến định tại Điều 65 Hiến pháp năm 2013.",
    category: "Chính trị",
    difficulty: "Trung bình"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Đồng chí hãy điền từ còn thiếu vào chỗ trống: 'Quân đội ta trung với Đảng, hiếu với dân, sẵn sàng chiến đấu hy sinh vì độc lập tự do của Tổ quốc, vì chủ nghĩa xã hội. Nhiệm vụ nào cũng hoàn thành, khó khăn nào cũng vượt qua, kẻ thù nào cũng ...'",
    options: [],
    correctAnswers: ["đánh thắng"],
    explanation: "Đây là lời khen ngợi của Chủ tịch Hồ Chí Minh nhân dịp kỷ niệm 20 năm ngày thành lập QĐND Việt Nam.",
    category: "Chính trị",
    difficulty: "Dễ"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Ai là Tổng Tư lệnh đầu tiên của Quân đội nhân dân Việt Nam?",
    options: [],
    correctAnswers: ["Võ Nguyên Giáp"],
    explanation: "Đại tướng Võ Nguyên Giáp là Tổng Tư lệnh đầu tiên kiêm Bộ trưởng Bộ Quốc phòng của nước Việt Nam Dân chủ Cộng hòa.",
    category: "Chính trị",
    difficulty: "Dễ"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Ngày truyền thống của lực lượng Dân quân tự vệ Việt Nam là ngày 28 tháng ... hàng năm.",
    options: [],
    correctAnswers: ["3"],
    explanation: "Ngày truyền thống Dân quân tự vệ là ngày 28/3 hàng năm.",
    category: "Chính trị",
    difficulty: "Trung bình"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Phương châm huấn luyện quân sự hiện nay của quân đội ta là: 'Cơ bản, thiết thực, vững chắc, coi trọng huấn luyện đồng bộ và ...'",
    options: [],
    correctAnswers: ["chuyên sâu"],
    explanation: "Phương châm huấn luyện đầy đủ là: Cơ bản, thiết thực, vững chắc, coi trọng huấn luyện đồng bộ và chuyên sâu.",
    category: "Chính trị",
    difficulty: "Khó"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Hệ tư tưởng lý luận nền tảng của Đảng Cộng sản Việt Nam là Chủ nghĩa Mác - Lênin và ...",
    options: [],
    correctAnswers: ["Tư tưởng Hồ Chí Minh"],
    explanation: "Đảng lấy chủ nghĩa Mác - Lênin và Tư tưởng Hồ Chí Minh làm kim chỉ nam cho mọi hành động.",
    category: "Chính trị",
    difficulty: "Dễ"
  },

  // === QUÂN SỰ (15 câu) ===
  {
    questionType: "multiple-choice",
    questionText: "Tầm bắn ghi trên thước ngắm lớn nhất của súng tiểu liên AK-47 là bao nhiêu mét?",
    options: ["800 mét", "1000 mét", "1500 mét", "2000 mét"],
    correctAnswers: ["1"],
    explanation: "Súng tiểu liên AK-47 có vạch thước ngắm lớn nhất ghi số 10, tương đương với tầm bắn thước ngắm 1000m.",
    category: "Quân sự",
    difficulty: "Dễ"
  },
  {
    questionType: "multiple-choice",
    questionText: "Súng tiểu liên AK sử dụng đạn cỡ bao nhiêu mm?",
    options: ["5.56 mm", "7.62 mm", "9 mm", "12.7 mm"],
    correctAnswers: ["1"],
    explanation: "Súng AK-47 sử dụng đạn cỡ 7.62 x 39 mm.",
    category: "Quân sự",
    difficulty: "Dễ"
  },
  {
    questionType: "multiple-choice",
    questionText: "Tốc độ đầu của đầu đạn súng tiểu liên AK-47 là bao nhiêu m/s?",
    options: ["710 m/s", "715 m/s", "725 m/s", "735 m/s"],
    correctAnswers: ["0"],
    explanation: "Tốc độ đầu của đầu đạn súng AK-47 khi rời nòng súng là khoảng 710 m/s.",
    category: "Quân sự",
    difficulty: "Trung bình"
  },
  {
    questionType: "multiple-choice",
    questionText: "Khi bắn súng tiểu liên AK ở tư thế nằm bắn không có bệ tỳ, góc bắn chuẩn của thân người so với hướng bắn là bao nhiêu độ?",
    options: ["Góc khoảng 15 - 30 độ", "Góc khoảng 20 - 45 độ", "Góc khoảng 45 - 60 độ", "Góc khoảng 90 độ"],
    correctAnswers: ["1"],
    explanation: "Tư thế nằm bắn chuẩn yêu cầu thân người hợp với hướng bắn một góc khoảng 20 đến 45 độ để hấp thụ lực giật tốt nhất.",
    category: "Quân sự",
    difficulty: "Trung bình"
  },
  {
    questionType: "multiple-choice",
    questionText: "Khối lượng của súng tiểu liên AK-47 khi không chứa đạn là bao nhiêu kg?",
    options: ["3.8 kg", "4.3 kg", "4.8 kg", "3.1 kg"],
    correctAnswers: ["1"],
    explanation: "Trọng lượng súng AK-47 không đạn là 4.3 kg (loại báng gỗ thông thường).",
    category: "Quân sự",
    difficulty: "Trung bình"
  },
  {
    questionType: "true-false",
    questionText: "Khi bắn súng AK, đường ngắm cơ bản là đường thẳng từ mắt người ngắm qua điểm chính giữa mép trên khe ngắm đến đỉnh đầu ngắm.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Định nghĩa đường ngắm cơ bản trong kỹ thuật bắn súng bộ binh.",
    category: "Quân sự",
    difficulty: "Dễ"
  },
  {
    questionType: "true-false",
    questionText: "Súng tiểu liên AK chỉ có một chế độ bắn duy nhất là bắn phát một.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["1"],
    explanation: "Súng AK có hai chế độ bắn: bắn liên thanh (tự động) và bắn phát một (bán tự động).",
    category: "Quân sự",
    difficulty: "Dễ"
  },
  {
    questionType: "true-false",
    questionText: "Tầm bắn hiệu quả của súng tiểu liên AK đối với mục tiêu mặt đất thông thường là khoảng 400 mét.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Mặc dù tầm bắn tối đa lớn, nhưng tầm bắn hiệu quả tiêu chuẩn của bộ binh sử dụng súng AK là 400m.",
    category: "Quân sự",
    difficulty: "Trung bình"
  },
  {
    questionType: "true-false",
    questionText: "Thuốc phóng trong đạn súng tiểu liên AK là loại thuốc súng không khói.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Hầu hết các loại đạn quân sự hiện đại đều sử dụng thuốc phóng không khói.",
    category: "Quân sự",
    difficulty: "Trung bình"
  },
  {
    questionType: "true-false",
    questionText: "Lựu đạn phi kim loại không thể phát hiện được bằng máy dò kim loại thông thường.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Lựu đạn phi kim sử dụng vỏ nhựa hoặc gốm làm máy dò kim loại rất khó phát hiện.",
    category: "Quân sự",
    difficulty: "Khó"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Hộp tiếp đạn của súng tiểu liên AK-47 chứa được tối đa bao nhiêu viên đạn?",
    options: [],
    correctAnswers: ["30"],
    explanation: "Hộp tiếp đạn tiêu chuẩn của súng AK-47 chứa tối đa 30 viên đạn.",
    category: "Quân sự",
    difficulty: "Dễ"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Tốc độ bắn chiến đấu của súng AK khi bắn liên thanh là khoảng bao nhiêu phát trên phút?",
    options: [],
    correctAnswers: ["100"],
    explanation: "Tốc độ bắn lý thuyết là 600 phát/phút, nhưng tốc độ bắn chiến đấu liên thanh thực tế là khoảng 100 phát/phút.",
    category: "Quân sự",
    difficulty: "Khó"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Súng diệt tăng B41 sử dụng cỡ đạn gốc nòng là bao nhiêu mm?",
    options: [],
    correctAnswers: ["40"],
    explanation: "Súng B41 có đường kính nòng súng là 40mm, đạn vượt cỡ đầu nòng.",
    category: "Quân sự",
    difficulty: "Khó"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Khi tập ngắm bắn, nếu người bắn ngắm lệch sang phải thì điểm chạm của đầu đạn trên bia sẽ lệch về phía nào?",
    options: [],
    correctAnswers: ["phải"],
    explanation: "Đường ngắm lệch về phía nào thì điểm chạm của đạn sẽ lệch tương ứng về phía đó.",
    category: "Quân sự",
    difficulty: "Dễ"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Đồng chí hãy cho biết tầm bắn thẳng của súng tiểu liên AK đối với mục tiêu người nằm là bao nhiêu mét?",
    options: [],
    correctAnswers: ["350"],
    explanation: "Tầm bắn thẳng của súng AK-47 đối với mục tiêu người nằm là 350m, mục tiêu người chạy là 525m.",
    category: "Quân sự",
    difficulty: "Khó"
  },

  // === TRUYỀN THỐNG QUÂN ĐỘI (15 câu) ===
  {
    questionType: "multiple-choice",
    questionText: "Quân đội nhân dân Việt Nam được thành lập vào ngày tháng năm nào?",
    options: ["Ngày 22/12/1944", "Ngày 19/08/1945", "Ngày 02/09/1945", "Ngày 30/04/1975"],
    correctAnswers: ["0"],
    explanation: "Quân đội nhân dân Việt Nam tiền thân là Đội Việt Nam Tuyên truyền Giải phóng quân được thành lập ngày 22/12/1944.",
    category: "Truyền thống quân đội",
    difficulty: "Dễ"
  },
  {
    questionType: "multiple-choice",
    questionText: "Tên gọi đầu tiên của Quân đội nhân dân Việt Nam là gì?",
    options: ["Cứu quốc quân", "Đội Việt Nam Tuyên truyền Giải phóng quân", "Vệ quốc đoàn", "Quân đội Quốc gia Việt Nam"],
    correctAnswers: ["1"],
    explanation: "Đội Việt Nam Tuyên truyền Giải phóng quân thành lập ngày 22/12/1944 tại Cao Bằng là tên gọi đầu tiên.",
    category: "Truyền thống quân đội",
    difficulty: "Dễ"
  },
  {
    questionType: "multiple-choice",
    questionText: "Chiến dịch Điện Biên Phủ giành thắng lợi hoàn toàn vào ngày tháng năm nào?",
    options: ["Ngày 30/04/1954", "Ngày 07/05/1954", "Ngày 19/05/1954", "Ngày 27/07/1954"],
    correctAnswers: ["1"],
    explanation: "Chiều ngày 07/05/1954, tập đoàn cứ điểm Điện Biên Phủ của Pháp bị tiêu diệt hoàn toàn, chiến dịch kết thúc thắng lợi.",
    category: "Truyền thống quân đội",
    difficulty: "Dễ"
  },
  {
    questionType: "multiple-choice",
    questionText: "Ai là người cắm lá cờ chiến thắng trên nóc hầm tướng De Castries vào ngày 07/05/1954?",
    options: ["Tạ Quốc Luật", "Bùi Quang Thận", "Nguyễn Quốc Trị", "La Văn Cầu"],
    correctAnswers: ["0"],
    explanation: "Đồng chí Tạ Quốc Luật, chỉ huy tổ xung kích, là người trực tiếp vào hầm bắt sống tướng De Castries và cắm cờ chiến thắng.",
    category: "Truyền thống quân đội",
    difficulty: "Trung bình"
  },
  {
    questionType: "multiple-choice",
    questionText: "Trận 'Điện Biên Phủ trên không' đánh bại cuộc tập kích bằng máy bay B-52 của Mỹ vào Hà Nội diễn ra vào năm nào?",
    options: ["Năm 1968", "Năm 1972", "Năm 1973", "Năm 1975"],
    correctAnswers: ["1"],
    explanation: "Chiến dịch phòng không Hà Nội - Hải Phòng chống B-52 diễn ra từ 18/12 đến 30/12/1972.",
    category: "Truyền thống quân đội",
    difficulty: "Trung bình"
  },
  {
    questionType: "true-false",
    questionText: "Đội Việt Nam Tuyên truyền Giải phóng quân ban đầu khi thành lập gồm có 34 chiến sĩ.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Lực lượng ban đầu gồm 34 chiến sĩ với 34 khẩu súng dưới sự chỉ huy trực tiếp của đồng chí Võ Nguyên Giáp.",
    category: "Truyền thống quân đội",
    difficulty: "Dễ"
  },
  {
    questionType: "true-false",
    questionText: "Chiến thắng Phai Khắt, Nà Ngần là hai trận đánh đầu tiên của Đội Việt Nam Tuyên truyền Giải phóng quân ngay sau khi thành lập.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Trận Phai Khắt diễn ra ngày 25/12/1944 và trận Nà Ngần ngày 26/12/1944 đều giành thắng lợi lớn.",
    category: "Truyền thống quân đội",
    difficulty: "Trung bình"
  },
  {
    questionType: "true-false",
    questionText: "Đại tướng Nguyễn Chí Thanh là vị Đại tướng đầu tiên của Quân đội nhân dân Việt Nam.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["1"],
    explanation: "Đại tướng Võ Nguyên Giáp là vị Đại tướng đầu tiên phong năm 1948. Đại tướng Nguyễn Chí Thanh được phong năm 1959.",
    category: "Truyền thống quân đội",
    difficulty: "Trung bình"
  },
  {
    questionType: "true-false",
    questionText: "Chiến dịch Hồ Chí Minh giải phóng hoàn toàn miền Nam thống nhất đất nước chính thức bắt đầu ngày 26 tháng 4 năm 1975.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Chiến dịch giải phóng Sài Gòn mang tên Chiến dịch Hồ Chí Minh bắt đầu nổ súng từ ngày 26/4 và thắng lợi hoàn toàn ngày 30/4/1975.",
    category: "Truyền thống quân đội",
    difficulty: "Trung bình"
  },
  {
    questionType: "true-false",
    questionText: "Anh hùng liệt sĩ Cù Chính Lan nổi tiếng với hành động lấy thân mình lấp lỗ châu mai.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["1"],
    explanation: "Anh hùng Phan Đình Giót lấy thân mình lấp lỗ châu mai. Anh hùng Cù Chính Lan nổi tiếng với việc dùng lựu đạn diệt xe tăng Pháp.",
    category: "Truyền thống quân đội",
    difficulty: "Dễ"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Đội Việt Nam Tuyên truyền Giải phóng quân được thành lập tại khu rừng Trần Hưng Đạo thuộc tỉnh nào?",
    options: [],
    correctAnswers: ["Cao Bằng"],
    explanation: "Nơi thành lập là tại khu rừng Trần Hưng Đạo, huyện Nguyên Bình, tỉnh Cao Bằng.",
    category: "Truyền thống quân đội",
    difficulty: "Dễ"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Người chỉ huy cắm lá cờ trên nóc Dinh Độc Lập trưa ngày 30/4/1975 giải phóng miền Nam là anh hùng Bùi Quang ...",
    options: [],
    correctAnswers: ["Thận"],
    explanation: "Trung úy Bùi Quang Thận, Đại đội trưởng xe tăng, là người cắm cờ trên nóc Dinh Độc Lập.",
    category: "Truyền thống quân đội",
    difficulty: "Dễ"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Câu nói nổi tiếng của liệt sĩ Nguyễn Viết Xuân trong chiến đấu là: 'Nhằm thẳng ... mà bắn!'",
    options: [],
    correctAnswers: ["quân thù"],
    explanation: "Khẩu hiệu chiến đấu anh dũng của Anh hùng Nguyễn Viết Xuân là 'Nhằm thẳng quân thù mà bắn!'",
    category: "Truyền thống quân đội",
    difficulty: "Dễ"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Tổ chức tiền thân đầu tiên của Hải quân nhân dân Việt Nam là Cục Phòng thủ bờ ... thành lập năm 1955.",
    options: [],
    correctAnswers: ["bể"],
    explanation: "Ngày 07/5/1955, Cục Phòng thủ bờ bể được thành lập, là mốc son ra đời của Hải quân.",
    category: "Truyền thống quân đội",
    difficulty: "Khó"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Lực lượng Không quân nhân dân Việt Nam bắn rơi máy bay Mỹ đầu tiên vào năm nào?",
    options: [],
    correctAnswers: ["1965"],
    explanation: "Trận đánh đầu tiên chiến thắng ngày 3/4/1965 tại Hàm Rồng, Thanh Hóa, không quân ta bắn rơi máy bay F-8 của Mỹ.",
    category: "Truyền thống quân đội",
    difficulty: "Khó"
  },

  // === ĐIỀU LỆNH (13 câu) ===
  {
    questionType: "multiple-choice",
    questionText: "Quân nhân trong Quân đội nhân dân Việt Nam có bao nhiêu lời thề danh dự?",
    options: ["5 lời thề", "10 lời thề", "12 lời thề", "15 lời thề"],
    correctAnswers: ["1"],
    explanation: "Quân đội nhân dân Việt Nam có 10 lời thề danh dự của quân nhân.",
    category: "Điều lệnh",
    difficulty: "Dễ"
  },
  {
    questionType: "multiple-choice",
    questionText: "Có bao nhiêu điều kỷ luật khi quan hệ với nhân dân đối với quân nhân?",
    options: ["8 điều", "10 điều", "12 điều", "14 điều"],
    correctAnswers: ["2"],
    explanation: "Mười hai (12) điều kỷ luật khi quan hệ với nhân dân được quy định rõ trong Điều lệnh quản lý bộ đội.",
    category: "Điều lệnh",
    difficulty: "Trung bình"
  },
  {
    questionType: "multiple-choice",
    questionText: "Khi đi đường gặp cấp trên trực tiếp, quân nhân phải làm gì theo điều lệnh?",
    options: ["Đi qua bình thường không cần chào", "Chủ động đứng lại chào", "Chủ động thực hiện động tác chào theo quy định", "Đợi cấp trên chào trước rồi chào lại"],
    correctAnswers: ["2"],
    explanation: "Quân nhân gặp cấp trên phải chủ động thực hiện động tác chào đúng điều lệnh tác phong quân đội.",
    category: "Điều lệnh",
    difficulty: "Dễ"
  },
  {
    questionType: "multiple-choice",
    questionText: "Khi nghe khẩu lệnh 'Đằng sau - Quay!', hướng quay chuẩn của quân nhân là về phía nào và quay bao nhiêu độ?",
    options: ["Quay sang phải 180 độ", "Quay sang trái 180 độ", "Quay sang phải 90 độ", "Quay sang trái 90 độ"],
    correctAnswers: ["0"],
    explanation: "Khẩu lệnh Đằng sau quay yêu cầu quân nhân lấy gót chân phải làm trụ quay người sang bên phải hướng ra sau 180 độ.",
    category: "Điều lệnh",
    difficulty: "Trung bình"
  },
  {
    questionType: "true-false",
    questionText: "Trong quân đội, cấp dưới phải tuyệt đối chấp hành mệnh lệnh của cấp trên.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Đây là nguyên tắc cơ bản số 1 trong kỷ luật quân đội: 'Tuyệt đối phục tùng mệnh lệnh cấp trên'.",
    category: "Điều lệnh",
    difficulty: "Dễ"
  },
  {
    questionType: "true-false",
    questionText: "Khi ở trong phòng làm việc của cấp trên, quân nhân có thể tự ý ngồi hoặc hút thuốc mà không cần xin phép.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["1"],
    explanation: "Quân nhân vào phòng làm việc của chỉ huy phải báo cáo đứng nghiêm chỉnh, chỉ ngồi khi được phép và không tự tiện làm việc riêng.",
    category: "Điều lệnh",
    difficulty: "Dễ"
  },
  {
    questionType: "true-false",
    questionText: "Khi mặc quân phục chính quy, quân nhân tuyệt đối không được đeo đồ trang sức lộ ra ngoài trừ đồng hồ đeo tay và nhẫn cưới.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Quy định về lễ tiết tác phong khi mang mặc quân phục của QĐND Việt Nam.",
    category: "Điều lệnh",
    difficulty: "Trung bình"
  },
  {
    questionType: "true-false",
    questionText: "Khẩu lệnh 'Đi đều - Bước!' thì động tác bước đầu tiên luôn bắt đầu bằng chân phải.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["1"],
    explanation: "Khẩu lệnh di chuyển đội ngũ đi đều hoặc bước đều luôn bắt đầu bước chân trái trước.",
    category: "Điều lệnh",
    difficulty: "Dễ"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Đồng chí hãy điền số thích hợp: Trong ngày làm việc bình thường, quân đội duy trì chế độ sinh hoạt gồm bao nhiêu chế độ trong ngày?",
    options: [],
    correctAnswers: ["11"],
    explanation: "Chế độ sinh hoạt học tập trong ngày của quân nhân gồm có 11 chế độ.",
    category: "Điều lệnh",
    difficulty: "Trung bình"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Chế độ kiểm tra quân số, vũ khí trang bị trước khi đi ngủ vào buổi tối gọi là chế độ điểm danh điểm ...",
    options: [],
    correctAnswers: ["diện"],
    explanation: "Chế độ sinh hoạt tối gồm điểm danh, điểm diện quân số và vũ khí trang bị.",
    category: "Điều lệnh",
    difficulty: "Dễ"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Trong tuần làm việc, quân đội duy trì bao nhiêu chế độ trong tuần?",
    options: [],
    correctAnswers: ["3"],
    explanation: "Quân đội duy trì 3 chế độ trong tuần bao gồm: Chào cờ duyệt đội ngũ; Nhận xét tuần; Tổng vệ sinh doanh trại.",
    category: "Điều lệnh",
    difficulty: "Khó"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Động tác nghiêm: Hai gót chân sát nhau nằm trên một đường ngang thẳng, hai mũi bàn chân mở rộng tạo thành góc bao nhiêu độ?",
    options: [],
    correctAnswers: ["45"],
    explanation: "Động tác đứng nghiêm yêu cầu hai mũi bàn chân mở rộng tạo thành góc 45 độ.",
    category: "Điều lệnh",
    difficulty: "Dễ"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Khi báo cáo trực tiếp với cấp trên, cự ly đứng chuẩn từ cấp dưới đến cấp trên là từ 2 đến ... mét.",
    options: [],
    correctAnswers: ["3"],
    explanation: "Cự ly đứng báo cáo chuẩn điều lệnh đội ngũ là từ 2 đến 3 mét.",
    category: "Điều lệnh",
    difficulty: "Trung bình"
  },

  // === HẬU CẦN - KỸ THUẬT (12 câu) ===
  {
    questionType: "multiple-choice",
    questionText: "Nhiệm vụ trọng tâm của công tác Hậu cần quân đội là gì?",
    options: ["Quản lý tài chính đơn vị", "Bảo đảm ăn, mặc, ở, chăm sóc sức khỏe và vận chuyển cho bộ đội", "Mua sắm vũ khí mới", "Tăng gia sản xuất nông nghiệp đơn thuần"],
    correctAnswers: ["1"],
    explanation: "Nhiệm vụ cốt lõi của ngành Hậu cần là bảo đảm đời sống vật chất, sức khỏe và hành quân vận tải chiến đấu cho bộ đội.",
    category: "Hậu cần - Kỹ thuật",
    difficulty: "Dễ"
  },
  {
    questionType: "multiple-choice",
    questionText: "Khi lau chùi bảo dưỡng súng tiểu liên AK định kỳ, bộ phận nào tuyệt đối không được bôi mỡ bảo quản?",
    options: ["Bệ khóa nòng", "Nòng súng", "Hộp khóa nòng", "Các chi tiết bằng gỗ hoặc nhựa"],
    correctAnswers: ["3"],
    explanation: "Các chi tiết gỗ hoặc nhựa không được bôi mỡ súng vì mỡ làm hỏng mục chất liệu gỗ/nhựa.",
    category: "Hậu cần - Kỹ thuật",
    difficulty: "Trung bình"
  },
  {
    questionType: "multiple-choice",
    questionText: "Để phòng ngừa dịch bệnh tại đơn vị, biện pháp vệ sinh phòng dịch nào quan trọng nhất?",
    options: ["Sát khuẩn tay thường xuyên", "Ăn chín, uống sôi, vệ sinh nhà ăn nhà bếp doanh trại sạch sẽ", "Uống thuốc kháng sinh phòng ngừa", "Hạn chế ra ngoài doanh trại"],
    correctAnswers: ["1"],
    explanation: "Ăn chín, uống sôi và vệ sinh môi trường là biện pháp phòng dịch cơ bản nhất ngừa bệnh lây qua đường ăn uống.",
    category: "Hậu cần - Kỹ thuật",
    difficulty: "Dễ"
  },
  {
    questionType: "multiple-choice",
    questionText: "Quy trình bảo dưỡng kỹ thuật định kỳ cho vũ khí trang bị kỹ thuật nhóm 1 được thực hiện như thế nào?",
    options: ["Bảo dưỡng hàng ngày, hàng tuần", "Bảo dưỡng sau mỗi lần bắn, huấn luyện", "Bảo dưỡng hàng năm", "Cả A và B đúng"],
    correctAnswers: ["3"],
    explanation: "Bảo dưỡng kỹ thuật gồm bảo dưỡng hàng ngày, hàng tuần và bảo dưỡng đột xuất sau bắn, huấn luyện chiến đấu.",
    category: "Hậu cần - Kỹ thuật",
    difficulty: "Trung bình"
  },
  {
    questionType: "true-false",
    questionText: "Khi tiến hành sơ cứu băng bó vết thương hở, phải rắc trực tiếp bột kháng sinh hoặc thuốc mỡ lên vết thương trước khi băng.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["1"],
    explanation: "Tuyệt đối không tự ý rắc thuốc bột hoặc thuốc mỡ lên vết thương hở vì có thể gây nhiễm trùng sâu và cản trở việc xử lý y tế chuyên sâu.",
    category: "Hậu cần - Kỹ thuật",
    difficulty: "Trung bình"
  },
  {
    questionType: "true-false",
    questionText: "Mục đích của công tác kỹ thuật quân đội là giữ gìn tốt, dùng bền, an toàn, tiết kiệm vũ khí trang bị.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Đây là mục tiêu cốt lõi của công tác kỹ thuật quân sự.",
    category: "Hậu cần - Kỹ thuật",
    difficulty: "Dễ"
  },
  {
    questionType: "true-false",
    questionText: "Garô cầm máu chỉ được áp dụng đối với vết thương chảy máu động mạch ở tay hoặc chân và không được để quá 6 giờ liên tục.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Đúng nguyên tắc y học chiến thuật, garô lâu quá 6 giờ có thể gây hoại tử phần chi bên dưới.",
    category: "Hậu cần - Kỹ thuật",
    difficulty: "Trung bình"
  },
  {
    questionType: "true-false",
    questionText: "Vũ khí trang bị kỹ thuật khi vận chuyển cất giữ trong kho không cần phải tháo đạn ra khỏi súng.",
    options: ["Đúng", "Sai"],
    correctAnswers: ["1"],
    explanation: "Bắt buộc phải kiểm tra tháo hết đạn ra khỏi buồng đạn và hộp tiếp đạn trước khi bảo quản lưu kho để bảo đảm an toàn cháy nổ.",
    category: "Hậu cần - Kỹ thuật",
    difficulty: "Dễ"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Cuộc vận động nâng cao hiệu quả công tác kỹ thuật quân sự hiện nay mang mã số cuộc vận động là bao nhiêu?",
    options: [],
    correctAnswers: ["50"],
    explanation: "Đó là Cuộc vận động 50: 'Quản lý, khai thác vũ khí trang bị kỹ thuật tốt, bền, an toàn, tiết kiệm và an toàn giao thông'.",
    category: "Hậu cần - Kỹ thuật",
    difficulty: "Trung bình"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Khi băng bó vết thương gãy xương cẳng tay, ta phải dùng nẹp gỗ cố định từ khớp cổ tay đến khớp khuỷu ...",
    options: [],
    correctAnswers: ["tay"],
    explanation: "Quy tắc cố định xương gãy phải cố định chắc chắn hai khớp liền kề ổ gãy.",
    category: "Hậu cần - Kỹ thuật",
    difficulty: "Dễ"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Tiêu chuẩn lượng nước sạch tối thiểu cung cấp cho một quân nhân ăn uống, sinh hoạt hàng ngày ở dã ngoại là bao nhiêu lít?",
    options: [],
    correctAnswers: ["15"],
    explanation: "Theo chuẩn hậu cần dã ngoại, định mức tối thiểu là 15 lít nước/người/ngày.",
    category: "Hậu cần - Kỹ thuật",
    difficulty: "Khó"
  },
  {
    questionType: "fill-in-the-blank",
    questionText: "Loại dầu dùng để lau sạch thuôc súng bám trên nòng súng sau khi bắn gọi là dầu lau ...",
    options: [],
    correctAnswers: ["súng"],
    explanation: "Dầu chuyên dụng dùng để hòa tan cặn bám thuốc súng và bảo quản bề mặt thép của súng.",
    category: "Hậu cần - Kỹ thuật",
    difficulty: "Dễ"
  }
];

const generatedQuestions = questionsPool.map((q, idx) => {
  return {
    _id: {
      "$oid": `beef000000000000000000${idx.toString(16).padStart(2, '0')}`
    },
    questionType: q.questionType,
    questionText: q.questionText,
    options: q.options,
    correctAnswers: q.correctAnswers,
    explanation: q.explanation || "",
    category: q.category,
    difficulty: q.difficulty,
    creatorId: getRandomCreator(),
    createdAt: {
      "$date": new Date(Date.now() - idx * 3600000).toISOString()
    }
  };
});

const outputPath = path.join(__dirname, '..', '..', 'bank_questions_import.json');
fs.writeFileSync(outputPath, JSON.stringify(generatedQuestions, null, 2), 'utf8');
console.log(`Successfully generated ${generatedQuestions.length} questions and saved to ${outputPath}`);
