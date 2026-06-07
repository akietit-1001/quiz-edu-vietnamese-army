import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

dotenv.config();

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
  // Birth year between 1995 and 2007 (ages 19 to 31)
  const year = Math.floor(Math.random() * 12) + 1995;
  const month = Math.floor(Math.random() * 12);
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(year, month, day);
};

const mockData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/quiz-edu';
    console.log('Connecting to MongoDB at:', mongoUri);
    await mongoose.connect(mongoUri);

    console.log('Clearing existing users...');
    await User.deleteMany({});

    console.log('Pre-hashing default password for speed...');
    const hashedPassword = await bcrypt.hash('dongchi123', 10);

    const usersToInsert = [];
    let userIndex = 1;

    // 1. Create Master Admin
    const adminName = 'Nguyễn Văn Quyết';
    usersToInsert.push({
      email: 'ndakiet1001@gmail.com',
      password: hashedPassword,
      fullName: adminName,
      dateOfBirth: new Date(1985, 4, 15),
      rank: 'Thượng tá',
      position: 'Chỉ huy trưởng',
      unit: 'Phòng Đào tạo - Học viện Kỹ thuật Quân sự',
      address: 'Hà Nội',
      role: 'master-admin',
      twoFactorEnabled: false
    });

    console.log('Generating 699 hierarchical military users (3 Battalions)...');

    // Loop through 3 Battalions
    for (let b = 1; b <= 3; b++) {
      const bUnit = `Tiểu đoàn ${b}`;
      
      // Battalion Commanders
      // Battalion Commander
      const bCmdName = generateRandomName();
      usersToInsert.push({
        email: generateEmail(bCmdName, userIndex++),
        password: hashedPassword,
        fullName: bCmdName,
        dateOfBirth: generateDOB(),
        rank: b === 1 ? 'Trung tá' : 'Thiếu tá',
        position: 'Tiểu đoàn trưởng',
        unit: bUnit,
        address: 'Hà Nội',
        role: 'admin'
      });

      // Battalion Deputy Commander
      const bDepName = generateRandomName();
      usersToInsert.push({
        email: generateEmail(bDepName, userIndex++),
        password: hashedPassword,
        fullName: bDepName,
        dateOfBirth: generateDOB(),
        rank: 'Thiếu tá',
        position: 'Tiểu đoàn phó',
        unit: bUnit,
        address: 'Hải Phòng',
        role: 'admin'
      });

      // Loop through 3 Companies per Battalion
      for (let c = 1; c <= 3; c++) {
        const cUnit = `Đại đội ${c} - ${bUnit}`;

        // Company Commanders
        // Company Commander
        const cCmdName = generateRandomName();
        usersToInsert.push({
          email: generateEmail(cCmdName, userIndex++),
          password: hashedPassword,
          fullName: cCmdName,
          dateOfBirth: generateDOB(),
          rank: 'Đại úy',
          position: 'Đại đội trưởng',
          unit: cUnit,
          address: 'Đà Nẵng',
          role: 'admin'
        });

        // Company Deputy Commander
        const cDepName = generateRandomName();
        usersToInsert.push({
          email: generateEmail(cDepName, userIndex++),
          password: hashedPassword,
          fullName: cDepName,
          dateOfBirth: generateDOB(),
          rank: 'Thượng úy',
          position: 'Đại đội phó',
          unit: cUnit,
          address: 'Quảng Ninh',
          role: 'admin'
        });

        // Loop through 3 Platoons per Company
        for (let p = 1; p <= 3; p++) {
          const pUnit = `Trung đội ${p} - ${cUnit}`;

          // Platoon Leader (Trung đội trưởng)
          const pLdrName = generateRandomName();
          usersToInsert.push({
            email: generateEmail(pLdrName, userIndex++),
            password: hashedPassword,
            fullName: pLdrName,
            dateOfBirth: generateDOB(),
            rank: 'Trung úy',
            position: 'Trung đội trưởng',
            unit: pUnit,
            address: 'Hà Nam',
            role: 'sub-admin'
          });

          // Platoon Deputy (Trung đội phó)
          const pDepName = generateRandomName();
          usersToInsert.push({
            email: generateEmail(pDepName, userIndex++),
            password: hashedPassword,
            fullName: pDepName,
            dateOfBirth: generateDOB(),
            rank: 'Thiếu úy',
            position: 'Trung đội phó',
            unit: pUnit,
            address: 'Thanh Hóa',
            role: 'sub-admin'
          });

          // Loop for soldiers (23 soldiers, including 3 squad leaders)
          for (let s = 1; s <= 23; s++) {
            const isSquadLeader = s <= 3;
            const soldierName = generateRandomName();
            
            let rank = 'Binh nhì';
            if (isSquadLeader) {
              rank = s === 1 ? 'Trung sĩ' : 'Hạ sĩ';
            } else {
              rank = Math.random() > 0.4 ? 'Binh nhất' : 'Binh nhì';
            }

            usersToInsert.push({
              email: generateEmail(soldierName, userIndex++),
              password: hashedPassword,
              fullName: soldierName,
              dateOfBirth: generateDOB(),
              rank: rank,
              position: isSquadLeader ? `Tiểu đội trưởng Tiểu đội ${s}` : 'Chiến sĩ',
              unit: pUnit,
              address: 'Nghệ An',
              role: 'user'
            });
          }
        }
      }
    }

    console.log(`Inserting ${usersToInsert.length} users into the database...`);
    // Insert in chunks of 100 for better performance
    const chunkSize = 100;
    for (let i = 0; i < usersToInsert.length; i += chunkSize) {
      const chunk = usersToInsert.slice(i, i + chunkSize);
      await User.insertMany(chunk);
      console.log(`Inserted chunk ${i / chunkSize + 1} (${chunk.length} users)`);
    }

    console.log('--- USER DATA MOCKING SUCCESSFUL ---');
    console.log(`Total generated users: ${usersToInsert.length}`);
    console.log('All accounts password set to: dongchi123');
    console.log('Master Admin Email: ndakiet1001@gmail.com');
  } catch (error) {
    console.error('Error seeding data:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
};

mockData();
