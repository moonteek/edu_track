require('dotenv/config');
const bcrypt = require('bcryptjs');
const connectDB = require('./db');
const Admin = require('../models/Admin');

async function createAdmin() {
  const args = process.argv.slice(2);
  const username = args[0] || process.env.ADMIN_USERNAME || 'admin';
  const password = args[1] || process.env.ADMIN_PASSWORD || 'admin123';

  if (!username || !password) {
    console.error('Usage: node lib/create-admin.js <username> <password>');
    process.exit(1);
  }

  try {
    await connectDB();
    const cleanUser = username.trim().toLowerCase();
    const existing = await Admin.findOne({ username: cleanUser });
    if (existing) {
      console.log(`Admin user "${cleanUser}" already exists.`);
      process.exit(0);
    }

    const salt = 10;
    const hash = bcrypt.hashSync(password, salt);
    await Admin.create({ username: cleanUser, hash });
    console.log(`✅ Admin user "${cleanUser}" created successfully!`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create admin:', err.message);
    process.exit(1);
  }
}

createAdmin();
