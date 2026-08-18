import { describe, it, expect, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import { ensureDbConnected, createTestUnit } from './helpers.js';

let User, Unit, Quiz, QuestionBank;

beforeAll(async () => {
  await ensureDbConnected();
  User = (await import('../models/User.js')).default;
  Unit = (await import('../models/Unit.js')).default;
  Quiz = (await import('../models/Quiz.js')).default;
  QuestionBank = (await import('../models/QuestionBank.js')).default;
});

describe('Model: Unit', () => {
  it('tạo đơn vị cấp gốc (level 1, parentId null) thành công', async () => {
    const unit = await Unit.create({ name: 'Bộ CHQS Test', level: 1, parentId: null });
    expect(unit._id).toBeDefined();
    expect(unit.level).toBe(1);
  });

  it('từ chối level ngoài khoảng 1-3', async () => {
    let error = null;
    try {
      await Unit.create({ name: 'Đơn vị sai cấp', level: 5, parentId: null });
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeNull();
    expect(error.name).toBe('ValidationError');
  });

  it('không cho phép 2 đơn vị con cùng tên dưới cùng 1 cha (unique index)', async () => {
    const parent = await createTestUnit({ level: 1 });
    await Unit.create({ name: 'Đại đội trùng tên', level: 3, parentId: parent._id });
    let error = null;
    try {
      await Unit.create({ name: 'Đại đội trùng tên', level: 3, parentId: parent._id });
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeNull();
    // Lỗi trùng unique index của MongoDB có code 11000, KHÔNG PHẢI
    // ValidationError của Mongoose — một điểm dễ nhầm khi viết code xử lý lỗi
    // ở tầng controller (nếu chỉ bắt `error.name === 'ValidationError'` sẽ bỏ sót lỗi này).
    expect(error.code).toBe(11000);
  });
});

describe('Model: User', () => {
  it('băm mật khẩu bằng bcrypt trước khi lưu, không lưu plaintext', async () => {
    const unit = await createTestUnit();
    const user = await User.create({
      personnelType: 'soldier',
      username: `hashtest_${Date.now()}`,
      password: 'PlainPassword123',
      fullName: 'Test Hash User',
      dateOfBirth: new Date('1999-01-01'),
      unitId: unit._id
    });
    expect(user.password).not.toBe('PlainPassword123');
    expect(user.password.startsWith('$2')).toBe(true); // bcrypt hash prefix
  });

  it('comparePassword() trả về true với mật khẩu đúng, false với mật khẩu sai', async () => {
    const unit = await createTestUnit();
    const user = await User.create({
      personnelType: 'soldier',
      username: `cmptest_${Date.now()}`,
      password: 'CorrectPassword',
      fullName: 'Test Compare',
      dateOfBirth: new Date('1999-01-01'),
      unitId: unit._id
    });
    expect(await user.comparePassword('CorrectPassword')).toBe(true);
    expect(await user.comparePassword('WrongPassword')).toBe(false);
  });

  it('officer bắt buộc phải có email; soldier bắt buộc phải có username', async () => {
    const unit = await createTestUnit();
    let errOfficer = null;
    try {
      await User.create({
        personnelType: 'officer',
        password: 'x', fullName: 'No Email Officer',
        dateOfBirth: new Date('1999-01-01'), unitId: unit._id
      });
    } catch (e) { errOfficer = e; }
    expect(errOfficer).not.toBeNull();
    expect(errOfficer.errors.email).toBeDefined();

    let errSoldier = null;
    try {
      await User.create({
        personnelType: 'soldier',
        password: 'x', fullName: 'No Username Soldier',
        dateOfBirth: new Date('1999-01-01'), unitId: unit._id
      });
    } catch (e) { errSoldier = e; }
    expect(errSoldier).not.toBeNull();
    expect(errSoldier.errors.username).toBeDefined();
  });

  it('role mặc định là "user" nếu không truyền', async () => {
    const unit = await createTestUnit();
    const user = await User.create({
      personnelType: 'soldier',
      username: `roletest_${Date.now()}`,
      password: 'x',
      fullName: 'Default Role',
      dateOfBirth: new Date('1999-01-01'),
      unitId: unit._id
    });
    expect(user.role).toBe('user');
  });
});

describe('Model: Quiz', () => {
  it('tự sinh shareCode 6 ký tự nếu không truyền', async () => {
    const unit = await createTestUnit();
    const user = await User.create({
      personnelType: 'soldier', username: `quizowner_${Date.now()}`, password: 'x',
      fullName: 'Owner', dateOfBirth: new Date('1999-01-01'), unitId: unit._id
    });
    const quiz = await Quiz.create({
      title: 'Đề test shareCode',
      creatorId: user._id,
      duration: 30,
      questions: []
    });
    expect(quiz.shareCode).toBeDefined();
    expect(quiz.shareCode.length).toBe(6);
  });

  it('category ngoài enum bị Mongoose từ chối', async () => {
    const unit = await createTestUnit();
    const user = await User.create({
      personnelType: 'soldier', username: `catowner_${Date.now()}`, password: 'x',
      fullName: 'Owner2', dateOfBirth: new Date('1999-01-01'), unitId: unit._id
    });
    let error = null;
    try {
      await Quiz.create({
        title: 'Đề sai category', creatorId: user._id, duration: 30,
        category: 'Không tồn tại trong enum', questions: []
      });
    } catch (e) { error = e; }
    expect(error).not.toBeNull();
    expect(error.errors.category).toBeDefined();
  });

  it('thiếu creatorId (required) bị từ chối', async () => {
    let error = null;
    try {
      await Quiz.create({ title: 'Đề thiếu creatorId', duration: 30, questions: [] });
    } catch (e) { error = e; }
    expect(error).not.toBeNull();
    expect(error.errors.creatorId).toBeDefined();
  });
});

describe('Model: QuestionBank', () => {
  it('difficulty ngoài enum (Dễ/Trung bình/Khó) bị từ chối', async () => {
    const unit = await createTestUnit();
    const user = await User.create({
      personnelType: 'soldier', username: `bankowner_${Date.now()}`, password: 'x',
      fullName: 'Owner3', dateOfBirth: new Date('1999-01-01'), unitId: unit._id
    });
    let error = null;
    try {
      await QuestionBank.create({
        questionType: 'multiple-choice',
        questionText: 'Câu hỏi test',
        options: ['A', 'B'],
        correctAnswers: ['A'],
        category: 'Khác',
        difficulty: 'Siêu khó',
        creatorId: user._id
      });
    } catch (e) { error = e; }
    expect(error).not.toBeNull();
    expect(error.errors.difficulty).toBeDefined();
  });
});
