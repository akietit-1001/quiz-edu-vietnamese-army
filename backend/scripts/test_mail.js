import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('GMAIL_USER:', process.env.GMAIL_USER);
console.log('GMAIL_APP_PASSWORD defined:', !!process.env.GMAIL_APP_PASSWORD);
console.log('GMAIL_APP_PASSWORD value:', process.env.GMAIL_APP_PASSWORD);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

transporter.sendMail({
  from: `"Test" <${process.env.GMAIL_USER}>`,
  to: process.env.GMAIL_USER,
  subject: 'Test SMTP Connection',
  text: 'Hello test SMTP connection'
}).then(info => {
  console.log('SUCCESS:', info.response);
  process.exit(0);
}).catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
