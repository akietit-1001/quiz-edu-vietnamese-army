import mongoose from 'mongoose';

const tempUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  otpCode: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  userData: {
    type: Object,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Automatically delete the document after 10 minutes (600 seconds)
  }
});

export default mongoose.model('TempUser', tempUserSchema);
