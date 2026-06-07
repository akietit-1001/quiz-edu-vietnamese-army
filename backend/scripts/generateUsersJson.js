import fs from 'fs';
import bcrypt from 'bcryptjs';

const FAMILY_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const MIDDLE_NAMES = ['Văn', 'Hữu', 'Đình', 'Đức', 'Minh', 'Hải', 'Quang', 'Tiến', 'Quốc', 'Ngọc', 'Tấn', 'Thanh', 'Xuân', 'Công', 'Sĩ'];
const FIRST_NAMES = ['Anh', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Giang', 'Hải', 'Hùng', 'Huy', 'Khánh', 'Nam', 'Phong', 'Quân', 'Sơn', 'Tùng', 'Việt', 'Chiến', 'Thắng', 'Luân', 'Duy', 'Lâm', 'Tuấn', 'Kha', 'Long', 'Khải'];

const removeAccents = (str) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

const generateRandomName = () => {
  const family = FAMILY_NAMES[Math.floor(Math.random() * FAMILY_NAMES.length)];
  const middle = MIDDLE_NAMES[Math.floor(Math.random() * MIDDLE_NAMES.length)];
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  return `${family} ${middle} ${first}`;
};

const generateEmail = (fullName, index) => {
  const accentless = removeAccents(fullName).toLowerCase().replace(/\s+/g, '');
  return `${accentless}${index}@gmail.com`;
};

const generateDOB = () => {
  const year = Math.floor(Math.random() * 12) + 1995;
  const month = Math.floor(Math.random() * 12);
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(year, month, day).toISOString();
};

const run = async () => {
  console.log('Pre-hashing default password "dongchi123"...');
  const hashedPassword = await bcrypt.hash('dongchi123', 10);
  const users = [];
  let userIndex = 1;

  // 1. Create Master Admin
  users.push({
    email: 'ndakiet1001@gmail.com',
    password: hashedPassword,
    fullName: 'Nguyễn Văn Quyết',
    dateOfBirth: new Date(1985, 4, 15).toISOString(),
    rank: 'Thượng tá',
    position: 'Chỉ huy trưởng',
    unit: 'Phòng Đào tạo - Học viện Kỹ thuật Quân sự',
    address: 'Hà Nội',
    role: 'master-admin',
    twoFactorEnabled: false,
    twoFactorSecret: '',
    createdAt: new Date().toISOString()
  });

  // Loop through 3 Battalions
  for (let b = 1; b <= 3; b++) {
    const bUnit = `Tiểu đoàn ${b}`;
    
    // Battalion Commander
    const bCmdName = generateRandomName();
    users.push({
      email: generateEmail(bCmdName, userIndex++),
      password: hashedPassword,
      fullName: bCmdName,
      dateOfBirth: generateDOB(),
      rank: b === 1 ? 'Trung tá' : 'Thiếu tá',
      position: 'Tiểu đoàn trưởng',
      unit: bUnit,
      address: 'Hà Nội',
      role: 'admin',
      twoFactorEnabled: false,
      twoFactorSecret: '',
      createdAt: new Date().toISOString()
    });

    // Battalion Deputy
    const bDepName = generateRandomName();
    users.push({
      email: generateEmail(bDepName, userIndex++),
      password: hashedPassword,
      fullName: bDepName,
      dateOfBirth: generateDOB(),
      rank: 'Thiếu tá',
      position: 'Tiểu đoàn phó',
      unit: bUnit,
      address: 'Hải Phòng',
      role: 'admin',
      twoFactorEnabled: false,
      twoFactorSecret: '',
      createdAt: new Date().toISOString()
    });

    // Loop through 3 Companies per Battalion
    for (let c = 1; c <= 3; c++) {
      const cUnit = `Đại đội ${c} - ${bUnit}`;

      // Company Commander
      const cCmdName = generateRandomName();
      users.push({
        email: generateEmail(cCmdName, userIndex++),
        password: hashedPassword,
        fullName: cCmdName,
        dateOfBirth: generateDOB(),
        rank: 'Đại úy',
        position: 'Đại đội trưởng',
        unit: cUnit,
        address: 'Đà Nẵng',
        role: 'admin',
        twoFactorEnabled: false,
        twoFactorSecret: '',
        createdAt: new Date().toISOString()
      });

      // Company Deputy
      const cDepName = generateRandomName();
      users.push({
        email: generateEmail(cDepName, userIndex++),
        password: hashedPassword,
        fullName: cDepName,
        dateOfBirth: generateDOB(),
        rank: 'Thượng úy',
        position: 'Đại đội phó',
        unit: cUnit,
        address: 'Quảng Ninh',
        role: 'admin',
        twoFactorEnabled: false,
        twoFactorSecret: '',
        createdAt: new Date().toISOString()
      });

      // Loop through 3 Platoons per Company
      for (let p = 1; p <= 3; p++) {
        const pUnit = `Trung đội ${p} - ${cUnit}`;

        // Platoon Leader
        const pLdrName = generateRandomName();
        users.push({
          email: generateEmail(pLdrName, userIndex++),
          password: hashedPassword,
          fullName: pLdrName,
          dateOfBirth: generateDOB(),
          rank: 'Trung úy',
          position: 'Trung đội trưởng',
          unit: pUnit,
          address: 'Hà Nam',
          role: 'sub-admin',
          twoFactorEnabled: false,
          twoFactorSecret: '',
          createdAt: new Date().toISOString()
        });

        // Platoon Deputy
        const pDepName = generateRandomName();
        users.push({
          email: generateEmail(pDepName, userIndex++),
          password: hashedPassword,
          fullName: pDepName,
          dateOfBirth: generateDOB(),
          rank: 'Thiếu úy',
          position: 'Trung đội phó',
          unit: pUnit,
          address: 'Thanh Hóa',
          role: 'sub-admin',
          twoFactorEnabled: false,
          twoFactorSecret: '',
          createdAt: new Date().toISOString()
        });

        // 23 soldiers
        for (let s = 1; s <= 23; s++) {
          const isSquadLeader = s <= 3;
          const soldierName = generateRandomName();
          let rank = 'Binh nhì';
          if (isSquadLeader) {
            rank = s === 1 ? 'Trung sĩ' : 'Hạ sĩ';
          } else {
            rank = Math.random() > 0.4 ? 'Binh nhất' : 'Binh nhì';
          }

          users.push({
            email: generateEmail(soldierName, userIndex++),
            password: hashedPassword,
            fullName: soldierName,
            dateOfBirth: generateDOB(),
            rank: rank,
            position: isSquadLeader ? `Tiểu đội trưởng  Tiểu đội ${s}` : 'Chiến sĩ',
            unit: pUnit,
            address: 'Nghệ An',
            role: 'user',
            twoFactorEnabled: false,
            twoFactorSecret: '',
            createdAt: new Date().toISOString()
          });
        }
      }
    }
  }

  const outputPath = '../users_import.json';
  fs.writeFileSync(outputPath, JSON.stringify(users, null, 2), 'utf-8');
  console.log(`Successfully generated JSON import file at: ${outputPath}`);
  console.log(`Total records written: ${users.length}`);
};

run();
