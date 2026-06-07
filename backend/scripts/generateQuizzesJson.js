import fs from 'fs';
import path from 'path';

// Helper to generate 24-character hexadecimal MongoDB ObjectId
const generateObjectIdHex = () => {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 24; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
};

// Helper to generate random sharing codes
const generateShareCode = (prefix) => {
  const digits = Math.floor(1000 + Math.random() * 9000); // 4 digits
  return `${prefix}${digits}`;
};

// Political Questions Pool (25 items)
const POLITICAL_QUESTIONS = [
  {
    questionText: "Chủ nghĩa Mác - Lênin gồm mấy bộ phận lý luận cấu thành?",
    questionType: "multiple-choice",
    options: ["2 bộ phận", "3 bộ phận (Triết học, Kinh tế chính trị, CNXH khoa học)", "4 bộ phận", "5 bộ phận"],
    correctAnswers: ["1"],
    explanation: "Chủ nghĩa Mác - Lênin gồm 3 bộ phận cấu thành là Triết học Mác-Lênin, Kinh tế chính trị Mác-Lênin và Chủ nghĩa xã hội khoa học."
  },
  {
    questionText: "Đảng Cộng sản Việt Nam được thành lập vào ngày, tháng, năm nào?",
    questionType: "multiple-choice",
    options: ["Ngày 03/02/1930", "Ngày 19/05/1930", "Ngày 02/09/1945", "Ngày 22/12/1944"],
    correctAnswers: ["0"],
    explanation: "Đảng Cộng sản Việt Nam thành lập ngày 3 tháng 2 năm 1930 tại Hội nghị hợp nhất các tổ chức cộng sản ở Hương Cảng, Trung Quốc dưới sự chủ trì của Nguyễn Ái Quốc."
  },
  {
    questionText: "Đội Việt Nam Tuyên truyền Giải phóng quân được thành lập ngày tháng năm nào và tại đâu?",
    questionType: "multiple-choice",
    options: [
      "Ngày 22/12/1944 tại Cao Bằng",
      "Ngày 19/08/1945 tại Hà Nội",
      "Ngày 02/09/1945 tại Quảng Trị",
      "Ngày 15/05/1941 tại Lạng Sơn"
    ],
    correctAnswers: ["0"],
    explanation: "Đội Việt Nam Tuyên truyền Giải phóng quân tiền thân của QĐNDVN được thành lập ngày 22/12/1944 tại khu rừng Trần Hưng Đạo, huyện Nguyên Bình, tỉnh Cao Bằng."
  },
  {
    questionText: "Ai là người trực tiếp chỉ huy kiêm Đội trưởng đầu tiên của Đội Việt Nam Tuyên truyền Giải phóng quân?",
    questionType: "multiple-choice",
    options: ["Đồng chí Võ Nguyên Giáp", "Đồng chí Hoàng Sâm", "Đồng chí Phùng Chí Kiên", "Đồng chí Trần Đăng Ninh"],
    correctAnswers: ["1"],
    explanation: "Đồng chí Hoàng Sâm là Đội trưởng đầu tiên, đồng chí Võ Nguyên Giáp trực tiếp chỉ huy chung."
  },
  {
    questionText: "Cương lĩnh chính trị đầu tiên của Đảng do ai soạn thảo?",
    questionType: "multiple-choice",
    options: ["Đồng chí Trần Phú", "Đồng chí Nguyễn Ái Quốc", "Đồng chí Lê Hồng Phong", "Đồng chí Nguyễn Văn Cừ"],
    correctAnswers: ["1"],
    explanation: "Nguyễn Ái Quốc (Hồ Chí Minh) là người soạn thảo Cương lĩnh chính trị đầu tiên được thông qua tại Hội nghị thành lập Đảng tháng 2/1930."
  },
  {
    questionText: "Quân đội nhân dân Việt Nam đặt dưới sự lãnh đạo tuyệt đối, trực tiếp về mọi mặt của ai?",
    questionType: "multiple-choice",
    options: ["Chính phủ nước CHXHCN Việt Nam", "Đảng Cộng sản Việt Nam", "Chủ tịch nước", "Bộ trưởng Bộ Quốc phòng"],
    correctAnswers: ["1"],
    explanation: "Đảng Cộng sản Việt Nam lãnh đạo Quân đội nhân dân Việt Nam tuyệt đối, trực tiếp về mọi mặt."
  },
  {
    questionText: "Tư tưởng Hồ Chí Minh là hệ thống quan điểm toàn diện và sâu sắc về những vấn đề cơ bản của cách mạng Việt Nam đúng hay sai?",
    questionType: "true-false",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Đây là định nghĩa chính xác về Tư tưởng Hồ Chí Minh được Đảng ta khẳng định."
  },
  {
    questionText: "Đại hội đại biểu toàn quốc lần thứ XIII của Đảng khẳng định vai trò chủ đạo của học thuyết nào?",
    questionType: "multiple-choice",
    options: ["Chủ nghĩa Mác - Lênin và tư tưởng Hồ Chí Minh", "Chủ nghĩa duy vật lịch sử", "Tư tưởng đổi mới xã hội", "Kinh tế thị trường"],
    correctAnswers: ["0"],
    explanation: "Đảng ta lấy chủ nghĩa Mác - Lênin và tư tưởng Hồ Chí Minh làm nền tảng tư tưởng, kim chỉ nam cho hành động."
  },
  {
    questionText: "Nguồn gốc hình thành nên bản chất cách mạng của Quân đội nhân dân Việt Nam xuất phát từ nhân dân, chiến đấu vì nhân dân.",
    questionType: "true-false",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Quân đội ta là quân đội của nhân dân, do nhân dân, vì nhân dân."
  },
  {
    questionText: "Bác Hồ viết bản Tuyên ngôn Độc lập năm nào?",
    questionType: "fill-in-the-blank",
    options: [],
    correctAnswers: ["1945"],
    explanation: "Bản Tuyên ngôn Độc lập được khai sinh ngày 2/9/1945 tại Quảng trường Ba Đình."
  },
  {
    questionText: "Nguyên tắc xây dựng quân đội về chính trị trong giai đoạn hiện nay tập trung vào yếu tố nào hàng đầu?",
    questionType: "multiple-choice",
    options: ["Vũ khí hiện đại", "Giữ vững sự lãnh đạo của Đảng", "Kỷ luật nghiêm minh", "Huấn luyện thể lực"],
    correctAnswers: ["1"],
    explanation: "Giữ vững và tăng cường sự lãnh đạo tuyệt đối, trực tiếp về mọi mặt của Đảng đối với Quân đội là nguyên tắc cốt lõi."
  },
  {
    questionText: "Phong trào 'Ba sẵn sàng' được phát động vào năm nào trong kháng chiến chống Mỹ?",
    questionType: "multiple-choice",
    options: ["1960", "1964", "1968", "1972"],
    correctAnswers: ["1"],
    explanation: "Phong trào Ba sẵn sàng của thanh niên miền Bắc được Ban chấp hành Trung ương Đoàn phát động vào tháng 8/1964."
  },
  {
    questionText: "Khẩu hiệu 'Nhằm thẳng quân thù mà bắn' là của anh hùng liệt sĩ nào?",
    questionType: "multiple-choice",
    options: ["Nguyễn Viết Xuân", "Cù Chính Lan", "Bế Văn Đàn", "Phan Đình Giót"],
    correctAnswers: ["0"],
    explanation: "Khẩu hiệu nổi tiếng 'Nhằm thẳng quân thù mà bắn' là của anh hùng liệt sĩ Nguyễn Viết Xuân trong kháng chiến chống Mỹ cứu nước."
  },
  {
    questionText: "Lực lượng quốc phòng toàn dân Việt Nam gồm lực lượng nào?",
    questionType: "multiple-choice",
    options: [
      "Toàn dân, lực lượng vũ trang nhân dân làm nòng cốt",
      "Chỉ gồm quân đội thường trực",
      "Quân đội và Công an",
      "Lực lượng cảnh sát biển và bộ đội biên phòng"
    ],
    correctAnswers: ["0"],
    explanation: "Nền quốc phòng toàn dân là sức mạnh tổng hợp của cả nước, do toàn dân tiến hành, lực lượng vũ trang nhân dân làm nòng cốt."
  },
  {
    questionText: "Mục đích xây dựng quân đội cách mạng, chính quy, tinh nhuệ, từng bước hiện đại là gì?",
    questionType: "multiple-choice",
    options: [
      "Bảo vệ vững chắc Tổ quốc Việt Nam Xã hội Chủ nghĩa",
      "Tham gia chiến tranh quốc tế",
      "Phát triển kinh tế đối ngoại",
      "Mở rộng lãnh thổ quốc gia"
    ],
    correctAnswers: ["0"],
    explanation: "Mục tiêu duy nhất của quốc phòng Việt Nam là tự vệ, bảo vệ độc lập, chủ quyền và toàn vẹn lãnh thổ đất nước."
  }
];

// Military Questions Pool (25 items)
const MILITARY_QUESTIONS = [
  {
    questionText: "Tầm bắn ghi trên thước ngắm của súng tiểu liên AK-47 là bao nhiêu mét?",
    questionType: "multiple-choice",
    options: ["500m", "800m", "1000m", "1500m"],
    correctAnswers: ["2"],
    explanation: "Tầm bắn ghi trên thước ngắm súng tiểu liên AK-47 là từ cự ly 100m đến 1000m."
  },
  {
    questionText: "Trọng lượng súng tiểu liên AK-47 khi lắp đủ 30 viên đạn là khoảng bao nhiêu kilôgam?",
    questionType: "multiple-choice",
    options: ["3.1 kg", "3.8 kg", "4.3 kg", "4.8 kg"],
    correctAnswers: ["2"],
    explanation: "Súng AK-47 không đạn nặng 3.8kg, khi lắp đủ hộp tiếp đạn 30 viên đạn nặng khoảng 4.3kg."
  },
  {
    questionText: "Súng tiểu liên AK sử dụng loại đạn nào sau đây?",
    questionType: "multiple-choice",
    options: ["Cỡ đạn 5.56 mm", "Cỡ đạn 7.62 x 39 mm", "Cỡ đạn 9 mm", "Cỡ đạn 12.7 mm"],
    correctAnswers: ["1"],
    explanation: "Súng tiểu liên AK sử dụng đạn cỡ 7.62 x 39 mm kiểu 1943 do Liên Xô thiết kế."
  },
  {
    questionText: "Tốc độ bắn chiến đấu của súng tiểu liên AK khi bắn phát một là bao nhiêu phát/phút?",
    questionType: "multiple-choice",
    options: ["40 phát/phút", "100 phát/phút", "150 phát/phút", "200 phát/phút"],
    correctAnswers: ["0"],
    explanation: "Tốc độ bắn chiến đấu phát một của súng AK là khoảng 40 phát/phút; khi bắn liên thanh là khoảng 100 phát/phút."
  },
  {
    questionText: "Huấn luyện kỹ thuật chiến đấu bộ binh gồm huấn luyện bắn súng, ném lựu đạn và gói thuốc nổ đúng hay sai?",
    questionType: "true-false",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Đây là 3 nội dung kỹ thuật chiến đấu bộ binh cơ bản của chiến sĩ mới."
  },
  {
    questionText: "Thước ngắm chiến đấu của súng tiểu liên AK tương đương với cự ly ngắm bắn bao nhiêu mét?",
    questionType: "multiple-choice",
    options: ["100m", "200m", "300m", "400m"],
    correctAnswers: ["2"],
    explanation: "Thước ngắm chiến đấu ký hiệu bằng chữ 'П' tương đương cự ly thước ngắm số 3 (300m)."
  },
  {
    questionText: "Quân nhân chấp hành kỷ luật quân đội phải thực hiện nghiêm 12 lời thề danh dự của quân nhân đúng hay sai?",
    questionType: "true-false",
    options: ["Đúng", "Sai"],
    correctAnswers: ["1"],
    explanation: "Quân nhân phải thực hiện nghiêm 10 Lời thề danh dự của quân nhân và 12 Điều kỷ luật khi quan hệ với nhân dân (chứ không phải 12 lời thề)."
  },
  {
    questionText: "Trọng lượng lựu đạn phi công LĐ-01 của Việt Nam chế tạo là bao nhiêu gam?",
    questionType: "multiple-choice",
    options: ["200g", "360g", "450g", "600g"],
    correctAnswers: ["1"],
    explanation: "Lựu đạn LĐ-01 có trọng lượng toàn bộ khoảng 360 - 400g."
  },
  {
    questionText: "Mục tiêu bia số 4 trong bài 1 bắn súng tiểu liên AK cự ly 100m biểu thị cho đối tượng nào?",
    questionType: "multiple-choice",
    options: ["Tên địch đứng bắn", "Tên địch quỳ bắn", "Tên địch nằm bắn", "Mục tiêu xe tăng"],
    correctAnswers: ["2"],
    explanation: "Bia số 4 là bia mục tiêu thu nhỏ biểu thị đối tượng địch nằm bắn."
  },
  {
    questionText: "Khi di chuyển đội ngũ, lệnh hành tiến 'Bước!' được phát ra rơi vào bàn chân nào?",
    questionType: "multiple-choice",
    options: ["Chân trái", "Chân phải", "Chân nào cũng được", "Cả hai chân cùng lúc"],
    correctAnswers: ["1"],
    explanation: "Động lệnh chạy hoặc đi đều ('Bước!' hoặc 'Chạy!') rơi vào bàn chân phải."
  },
  {
    questionText: "Thời gian cháy chậm của ngòi nổ lựu đạn LĐ-01 từ lúc xì lửa đến khi nổ là bao nhiêu giây?",
    questionType: "fill-in-the-blank",
    options: [],
    correctAnswers: ["3.2-4.2"],
    explanation: "Thời gian cháy chậm của lựu đạn LĐ-01 nằm trong khoảng 3.2 đến 4.2 giây."
  },
  {
    questionText: "Ai là người chỉ huy cao nhất của lực lượng vũ trang nhân dân Việt Nam?",
    questionType: "multiple-choice",
    options: ["Tổng Bí thư", "Chủ tịch nước", "Bộ trưởng Bộ Quốc phòng", "Tổng Tham mưu trưởng"],
    correctAnswers: ["1"],
    explanation: "Theo Hiến pháp, Chủ tịch nước thống lĩnh lực lượng vũ trang nhân dân, giữ chức Chủ tịch Hội đồng quốc phòng và an ninh."
  },
  {
    questionText: "Tốc độ đầu của đầu đạn súng tiểu liên AK-47 là bao nhiêu m/s?",
    questionType: "multiple-choice",
    options: ["710 m/s", "715 m/s", "735 m/s", "825 m/s"],
    correctAnswers: ["0"],
    explanation: "Tốc độ đầu của đầu đạn súng AK-47 là 710 m/s."
  },
  {
    questionText: "Hành động của chiến sĩ khi nghe lệnh 'Đứng lại!' trong đội ngũ đang đi đều là bước tiếp mấy bước nữa?",
    questionType: "multiple-choice",
    options: ["1 bước", "2 bước", "3 bước", "Không bước bước nào"],
    correctAnswers: ["0"],
    explanation: "Khi nghe dứt động lệnh 'Đứng lại!', quân nhân bước tiếp chân trái lên 1 bước, đưa chân phải lên khép lại thành tư thế nghiêm."
  },
  {
    questionText: "Khi gặp chất độc hóa học hoặc phóng xạ, chiến sĩ phải lập tức đeo mặt nạ phòng độc đúng hay sai?",
    questionType: "true-false",
    options: ["Đúng", "Sai"],
    correctAnswers: ["0"],
    explanation: "Đeo mặt nạ phòng độc kịp thời là biện pháp hàng đầu bảo vệ cơ quan hô hấp chống độc."
  }
];

const run = async () => {
  const usersPath = path.join(process.cwd(), 'users_import.json');
  if (!fs.existsSync(usersPath)) {
    console.error('File users_import.json not found in root workspace.');
    return;
  }

  console.log('Loading users_import.json...');
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

  // 1. Assign fixed _id (using MongoDB Extended JSON $oid format) to every user
  console.log('Assigning unique _ids to users...');
  users.forEach(user => {
    if (!user._id) {
      user._id = { $oid: generateObjectIdHex() };
    }
  });

  // Write updated users back to users_import.json
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
  console.log(`Updated users_import.json at: ${usersPath}`);

  // 2. Select creators according to user requirement:
  // 1 master-admin, 15 admins, 10 sub-admins, 4 users
  const masterAdmins = users.filter(u => u.role === 'master-admin');
  const admins = users.filter(u => u.role === 'admin');
  const subAdmins = users.filter(u => u.role === 'sub-admin');
  const regularUsers = users.filter(u => u.role === 'user');

  if (masterAdmins.length < 1 || admins.length < 15 || subAdmins.length < 10 || regularUsers.length < 4) {
    console.error('Not enough users of specific roles in users_import.json to map creators.');
    return;
  }

  // Slice selected creators
  const selectedMasterAdmin = masterAdmins.slice(0, 1);
  const selectedAdmins = admins.slice(0, 15);
  const selectedSubAdmins = subAdmins.slice(0, 10);
  const selectedUsers = regularUsers.slice(0, 4);

  // Combine into a list of 30 creators
  // 1 + 15 + 10 + 4 = 30
  const quizCreators = [
    ...selectedMasterAdmin,
    ...selectedAdmins,
    ...selectedSubAdmins,
    ...selectedUsers
  ];

  console.log(`Selected ${quizCreators.length} creators (1 master-admin, 15 admins, 10 sub-admins, 4 users)`);

  // 3. Generate 30 quizzes: 20 Political ("Chính trị") and 10 Military ("Quân sự")
  const quizzes = [];

  // Helper to get random questions subset
  const getRandomQuestions = (pool, count = 10) => {
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Generate 20 Political Quizzes
  for (let i = 1; i <= 20; i++) {
    const creator = quizCreators[i - 1]; // Map to first 20 creators
    const shareCode = generateShareCode('POL');
    quizzes.push({
      _id: { $oid: generateObjectIdHex() },
      title: `Đề thi trắc nghiệm Chính trị học kì - Đề số ${i}`,
      description: `Đề thi trắc nghiệm lý luận Chính trị, tư tưởng Hồ Chí Minh, lịch sử Đảng Cộng sản Việt Nam và truyền thống Quân đội nhân dân Việt Nam. Mã đề ${shareCode}.`,
      category: 'Chính trị',
      creatorId: creator._id, // References user._id.$oid
      duration: Math.random() > 0.5 ? 45 : 30,
      passingScorePercent: 60,
      questions: getRandomQuestions(POLITICAL_QUESTIONS, 10),
      shareCode: shareCode,
      isPublic: Math.random() > 0.3,
      createdAt: new Date(Date.now() - i * 3600000).toISOString() // slightly offset times
    });
  }

  // Generate 10 Military Quizzes
  for (let i = 1; i <= 10; i++) {
    const creator = quizCreators[19 + i]; // Map to remaining 10 creators (index 20 to 29)
    const shareCode = generateShareCode('MIL');
    quizzes.push({
      _id: { $oid: generateObjectIdHex() },
      title: `Đề kiểm tra Kỹ thuật Chiến thuật Quân sự - Đề số ${i}`,
      description: `Kiểm tra hiểu biết kỹ thuật bắn súng tiểu liên AK, ném lựu đạn điều lệnh quân đội và kiến thức tác chiến chiến thuật bộ binh. Mã đề ${shareCode}.`,
      category: 'Quân sự',
      creatorId: creator._id,
      duration: 45,
      passingScorePercent: 50,
      questions: getRandomQuestions(MILITARY_QUESTIONS, 10),
      shareCode: shareCode,
      isPublic: Math.random() > 0.4,
      createdAt: new Date(Date.now() - (20 + i) * 3600000).toISOString()
    });
  }

  const outputPath = path.join(process.cwd(), 'quizzes_import.json');
  fs.writeFileSync(outputPath, JSON.stringify(quizzes, null, 2), 'utf8');
  console.log(`Successfully generated quizzes import JSON at: ${outputPath}`);
  console.log(`Total quizzes generated: ${quizzes.length}`);
};

run();
