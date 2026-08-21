const bcrypt = require('bcryptjs');
const Teacher = require('../models/Teacher');
const Group = require('../models/Group');
const Admin = require('../models/Admin');

const SALT = 10;
let seeded = false;

async function seed() {
  if (seeded) return;
  const teacherCount = await Teacher.countDocuments();
  const groupCount = await Group.countDocuments();
  const adminCount = await Admin.countDocuments();

  if (adminCount === 0) {
    const adminUser = (process.env.ADMIN_USERNAME || 'moonteek').trim().toLowerCase();
    const adminPass = process.env.ADMIN_PASSWORD || '702009';
    await Admin.create({
      username: adminUser,
      hash: bcrypt.hashSync(adminPass, SALT),
    });
    console.log(`Seeded default admin (@${adminUser}).`);
  }

  // Mock teachers and groups seeding is disabled.
  seeded = true;
}

module.exports = seed;