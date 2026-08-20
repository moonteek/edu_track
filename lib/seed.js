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

  if (teacherCount > 0 && groupCount > 0) { seeded = true; return; }
  console.log('Seeding initial data...');

  let teachers = [];
  if (teacherCount === 0) {
    teachers = await Teacher.insertMany([
      { name: 'Alisher Nazarov', username: 'alisher.n', hash: bcrypt.hashSync('teacher123', SALT), subject: ['Web Development'] },
      { name: 'Malika Yusupova', username: 'malika.y', hash: bcrypt.hashSync('teacher123', SALT), subject: ['Web Development'] },
      { name: 'Bobur Toshmatov', username: 'bobur.t', hash: bcrypt.hashSync('teacher123', SALT), subject: ['Web Development'] },
      { name: 'Dilnoza Rahimova', username: 'dilnoza.r', hash: bcrypt.hashSync('teacher123', SALT), subject: ['Web Development'] },
      { name: 'Sardor Mirzayev', username: 'sardor.m', hash: bcrypt.hashSync('teacher123', SALT), subject: ['Web Development'] },
    ]);
  } else {
    teachers = await Teacher.find().limit(5);
  }

  if (groupCount === 0 && teachers.length > 0) {
    const tId = i => teachers[i % teachers.length]._id.toString();
    await Group.insertMany([
      { tid: tId(0), group: 'HTML Foundations', lang: 'HTML', startTime: '09:00', endTime: '11:00', days: 'Every Day', start: '2024-01-15', exam: '2024-03-15', students: 18, level: 1, doneInLevel: 10 },
      { tid: tId(0), group: 'CSS Masters', lang: 'CSS', startTime: '11:00', endTime: '13:00', days: 'Odd Days', start: '2024-02-01', exam: '2024-04-01', students: 22, level: 2, doneInLevel: 5 },
      { tid: tId(1), group: 'JS Advanced', lang: 'JavaScript', startTime: '14:00', endTime: '16:00', days: 'Every Day', start: '2024-01-20', exam: '2024-04-20', students: 15, level: 3, doneInLevel: 9 },
      { tid: tId(1), group: 'JS Basics', lang: 'JavaScript', startTime: '10:00', endTime: '12:00', days: 'Even Days', start: '2024-03-01', exam: '2024-05-20', students: 20, level: 1, doneInLevel: 4 },
      { tid: tId(2), group: 'React Batch 2', lang: 'React JS', startTime: '16:00', endTime: '18:00', days: 'Every Day', start: '2024-03-01', exam: '2024-06-01', students: 12, level: 2, doneInLevel: 7 },
      { tid: tId(2), group: 'React Batch 3', lang: 'React JS', startTime: '12:00', endTime: '14:00', days: 'Every Day', start: '2024-04-01', exam: '2024-07-01', students: 14, level: 1, doneInLevel: 5 },
      { tid: tId(3), group: 'Node Basics', lang: 'Node JS', startTime: '10:00', endTime: '12:00', days: 'Odd Days', start: '2024-02-15', exam: '2024-05-15', students: 16, level: 2, doneInLevel: 9 },
      { tid: tId(3), group: 'Node Advanced', lang: 'Node JS', startTime: '13:00', endTime: '15:00', days: 'Every Day', start: '2024-03-10', exam: '2024-06-10', students: 10, level: 1, doneInLevel: 8 },
      { tid: tId(4), group: 'Full Stack A', lang: 'React JS', startTime: '09:30', endTime: '11:30', days: 'Even Days', start: '2024-02-01', exam: '2024-07-01', students: 14, level: 3, doneInLevel: 4 },
      { tid: tId(4), group: 'Node + React', lang: 'Node JS', startTime: '14:30', endTime: '16:30', days: 'Every Day', start: '2024-03-15', exam: '2024-08-01', students: 11, level: 1, doneInLevel: 12 },
    ]);
  }
  seeded = true;
  console.log('Seed complete.');
}

module.exports = seed;