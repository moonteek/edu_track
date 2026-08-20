require('dotenv/config');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const connectDB = require('../lib/db');
const Teacher = require('../models/Teacher');
const Group = require('../models/Group');
const Admin = require('../models/Admin');
const seed = require('../lib/seed');

const app = express();

const rawFrontendUrl = (process.env.FRONTEND_URL || '*').trim();
const allowedOrigins = rawFrontendUrl === '*'
  ? '*'
  : rawFrontendUrl.split(',').flatMap(url => {
      const trimmed = url.trim();
      return [trimmed, trimmed.replace(/\/$/, '')];
    });

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Prevent aggressive caching on dynamic API routes by browsers/proxies (fixes "stale stats" issue)
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

const mongoose = require('mongoose');

// Root & health check endpoints (do not block on DB connection)
app.get('/', (_req, res) => res.json({ message: 'EduTrack API Backend is running' }));
app.get('/api', (_req, res) => res.json({
  status: 'ok',
  message: 'EduTrack API running',
  db: mongoose.connection.readyState === 1 ? 'connected' : mongoose.connection.readyState === 2 ? 'connecting' : 'disconnected'
}));

// Start seed process in the background immediately
connectDB().then(() => seed()).catch(console.error);

app.use(async (req, _res, next) => {
  try {
    await connectDB();
    next();
  }
  catch (err) {
    console.error('Database connection error:', err.message);
    next(err);
  }
});

const SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const SALT = 10;
const DEFAULT_LPL = 13;
const PC = {
  // Web Development
  'HTML': { levels: 1, category: 'Web Development', levelLessons: [10] },
  'CSS': { levels: 2, category: 'Web Development', levelLessons: [11, 13] },
  'JavaScript': { levels: 3, category: 'Web Development' },
  'TypeScript': { levels: 1, category: 'Web Development' },
  'React JS': { levels: 3, category: 'Web Development' },
  'Node JS': { levels: 3, category: 'Web Development' },
  'Web Prompt': { levels: 1, category: 'Web Development', levelLessons: [6] },
  // IT Kids
  'Python (Kids)': { levels: 3, category: 'IT Kids' },
  'Scratch': { levels: 3, category: 'IT Kids' },
  // Computer Literacy
  'Computer Literacy': { levels: 2, category: 'Computer Literacy' },
  // Graphic Design
  'Graphic Design': { levels: 6, category: 'Graphic Design' },
  // Cyber Security
  'Cyber Security': { levels: 8, category: 'Cyber Security' },
  // Python Backend
  'Python Backend': { levels: 9, category: 'Python Backend' },
  // AI
  'AI': { levels: 12, category: 'AI' },
  // Prompt Engineering
  'Prompt Engineering': { levels: 4, category: 'Prompt Engineering' },
  // SMM
  'Marketing': { levels: 2, category: 'SMM' },
  'Mobilography': { levels: 2, category: 'SMM' },
};
const LPL = 13;
const validLangs = Object.keys(PC);
const ADMIN_USER = process.env.ADMIN_USERNAME || 'moonteek';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || '702009';
const issueToken = payload => jwt.sign(payload, SECRET, { expiresIn: '30d' });

function getLessonsInLevel(lang, level = 1) {
  const cfg = PC[lang];
  if (!cfg) return DEFAULT_LPL;
  if (cfg.levelLessons && cfg.levelLessons[level - 1] !== undefined) {
    return cfg.levelLessons[level - 1];
  }
  return DEFAULT_LPL;
}

function totalLessons(lang) {
  const cfg = PC[lang];
  if (!cfg) return DEFAULT_LPL;
  let sum = 0;
  for (let i = 1; i <= cfg.levels; i++) {
    sum += getLessonsInLevel(lang, i);
  }
  return sum;
}

function totalDone(lang, level, doneInLevel) {
  let sum = 0;
  for (let i = 1; i < level; i++) {
    sum += getLessonsInLevel(lang, i);
  }
  return sum + Math.min(doneInLevel || 0, getLessonsInLevel(lang, level));
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authorization header missing' });
  try { req.user = jwt.verify(header.slice(7), SECRET); next(); }
  catch { res.status(401).json({ error: 'Token invalid or expired' }); }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  next();
}

app.post('/api/auth/admin', async (req, res) => {
  try {
    let { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const cleanUser = username.trim().toLowerCase();
    
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      if (cleanUser === ADMIN_USER.toLowerCase() && password === ADMIN_PASS) {
        return res.json({ token: issueToken({ role: 'admin' }) });
      }
    }
    
    const dbAdmin = await Admin.findOne({ username: cleanUser }).select('+hash');
    if (!dbAdmin || !bcrypt.compareSync(password, dbAdmin.hash)) {
      if (cleanUser === ADMIN_USER.toLowerCase() && password === ADMIN_PASS) {
        return res.json({ token: issueToken({ role: 'admin' }) });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json({ token: issueToken({ role: 'admin' }) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/teacher', async (req, res) => {
  try {
    let { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const cleanUser = username.trim().toLowerCase();
    const teacher = await Teacher.findOne({ username: cleanUser }).select('+hash');
    if (!teacher || !bcrypt.compareSync(password, teacher.hash)) return res.status(401).json({ error: 'Invalid credentials' });
    teacher.lastLogin = new Date();
    await teacher.save();
    res.json({ token: issueToken({ role: 'teacher', tid: teacher.id }), teacher: teacher.toJSON() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/teachers', auth, adminOnly, async (_req, res) => {
  try { res.json((await Teacher.find()).map(t => t.toJSON())); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/teachers/me', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only' });
    const t = await Teacher.findById(req.user.tid);
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(t.toJSON());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/teachers/me/availability', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only' });
    const teacher = await Teacher.findById(req.user.tid);
    if (!teacher) return res.status(404).json({ error: 'Not found' });

    if (req.body.oddDays) teacher.availability.oddDays = req.body.oddDays;
    if (req.body.evenDays) teacher.availability.evenDays = req.body.evenDays;

    await teacher.save();
    res.json(teacher.toJSON());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/teachers/me/password', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teachers only' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const teacher = await Teacher.findById(req.user.tid).select('+hash');
    if (!teacher) return res.status(404).json({ error: 'Not found' });
    if (!bcrypt.compareSync(currentPassword, teacher.hash)) return res.status(401).json({ error: 'Current password is incorrect' });
    teacher.hash = bcrypt.hashSync(newPassword, SALT);
    await teacher.save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/teachers', auth, adminOnly, async (req, res) => {
  try {
    let { name, username, password } = req.body;
    let subject = req.body.subject;
    // Normalize to array
    if (typeof subject === 'string') subject = [subject];
    if (!name || !username || !password || !subject || !subject.length) return res.status(400).json({ error: 'name, username, password, subject required' });
    username = username.trim().toLowerCase();
    if (subject.length > 2) return res.status(400).json({ error: 'Maximum 2 specializations allowed' });
    if (await Teacher.findOne({ username })) return res.status(409).json({ error: 'Username already taken' });
    const teacher = await Teacher.create({ name: name.trim(), username, hash: bcrypt.hashSync(password, SALT), subject });
    res.status(201).json(teacher.toJSON());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/teachers/:id', auth, adminOnly, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id).select('+hash');
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    let { name, username, password } = req.body;
    let subject = req.body.subject;
    if (typeof subject === 'string') subject = [subject];
    if (subject && subject.length > 2) return res.status(400).json({ error: 'Maximum 2 specializations allowed' });
    if (username) {
      username = username.trim().toLowerCase();
      if (username !== teacher.username && await Teacher.findOne({ username, _id: { $ne: req.params.id } })) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      teacher.username = username;
    }
    if (name) teacher.name = name.trim();
    if (subject && subject.length) teacher.subject = subject;
    if (password) teacher.hash = bcrypt.hashSync(password, SALT);
    if (req.body.availability) {
      teacher.availability = req.body.availability;
    }
    await teacher.save(); res.json(teacher.toJSON());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/teachers/:id', auth, adminOnly, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    const { deletedCount } = await Group.deleteMany({ tid: req.params.id });
    await teacher.deleteOne();
    res.json({ success: true, deletedGroups: deletedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admins', auth, adminOnly, async (req, res) => {
  try {
    let { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    username = username.trim().toLowerCase();
    if (await Admin.findOne({ username })) return res.status(409).json({ error: 'Username already taken' });
    
    const admin = await Admin.create({ username, hash: bcrypt.hashSync(password, SALT) });
    res.status(201).json(admin.toJSON());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admins', auth, adminOnly, async (_req, res) => {
  try {
    res.json((await Admin.find()).map(a => a.toJSON()));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admins/:id', auth, adminOnly, async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    await admin.deleteOne();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admins/:id', auth, adminOnly, async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    
    let { username, password } = req.body;
    if (username) {
      username = username.trim().toLowerCase();
      const existing = await Admin.findOne({ username, _id: { $ne: req.params.id } });
      if (existing) return res.status(409).json({ error: 'Username already taken' });
      admin.username = username;
    }
    if (password) {
      admin.hash = bcrypt.hashSync(password, SALT);
    }
    await admin.save();
    res.json(admin.toJSON());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/groups', auth, async (req, res) => {
  try {
    const showArchived = req.query.archived === 'true';
    const filter = req.user.role === 'admin' ? {} : { tid: req.user.tid };
    filter.archived = showArchived ? true : { $ne: true };
    res.json((await Group.find(filter).sort({ createdAt: 1 })).map(g => g.toJSON()));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/groups/:id/archive', auth, async (req, res) => {
  try {
    const g = await Group.findById(req.params.id);
    if (!g) return res.status(404).json({ error: 'Group not found' });
    if (req.user.role === 'teacher' && g.tid !== req.user.tid) return res.status(403).json({ error: 'Forbidden' });
    g.archived = true;
    g.archivedAt = new Date();
    await g.save();
    res.json(g.toJSON());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/groups/:id/unarchive', auth, async (req, res) => {
  try {
    const g = await Group.findById(req.params.id);
    if (!g) return res.status(404).json({ error: 'Group not found' });
    if (req.user.role === 'teacher' && g.tid !== req.user.tid) return res.status(403).json({ error: 'Forbidden' });
    g.archived = false;
    g.archivedAt = null;
    await g.save();
    res.json(g.toJSON());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/groups', auth, async (req, res) => {
  try {
    let { tid, group, lang, startTime, endTime, start, exam, students, level, doneInLevel, days } = req.body;
    if (req.user.role === 'teacher') tid = req.user.tid;
    if (!group || !lang || !startTime || !endTime || !start || !exam || !students || !level || !tid) return res.status(400).json({ error: 'All fields required' });
    if (!validLangs.includes(lang)) return res.status(400).json({ error: 'Invalid lang' });
    level = +level; doneInLevel = +(doneInLevel ?? 0);
    if (+students > 25 || +students < 1) return res.status(400).json({ error: 'A group must have between 1 and 25 students' });
    const cfg = PC[lang];
    if (level < 1 || level > cfg.levels) return res.status(400).json({ error: `Level must be between 1 and ${cfg.levels}` });
    const maxDim = getLessonsInLevel(lang, level);
    if (doneInLevel < 0 || doneInLevel > maxDim) return res.status(400).json({ error: `doneInLevel must be between 0 and ${maxDim}` });
    const dStart = new Date(start);
    const dExam = new Date(exam);
    if (isNaN(dStart.getTime()) || isNaN(dExam.getTime())) return res.status(400).json({ error: 'Invalid start or exam date' });
    if (dExam <= dStart) return res.status(400).json({ error: 'exam must be after start' });
    if (req.user.role === 'admin' && !(await Teacher.findById(tid))) return res.status(400).json({ error: 'Invalid tid' });

    if ((await Group.countDocuments({ tid, archived: { $ne: true } })) >= 10) return res.status(400).json({ error: 'A teacher cannot have more than 10 active groups' });

    const g = await Group.create({ tid, group: group.trim(), lang, startTime, endTime, start, exam, students: +students, level, doneInLevel, days: days || 'Every Day', autoProgress: true });
    res.status(201).json(g.toJSON());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/groups/:id', auth, async (req, res) => {
  try {
    const g = await Group.findById(req.params.id);
    if (!g) return res.status(404).json({ error: 'Group not found' });
    if (req.user.role === 'teacher' && g.tid !== req.user.tid) return res.status(403).json({ error: 'Forbidden' });

    const newLang = req.body.lang ?? g.lang;
    if (req.body.lang && !validLangs.includes(req.body.lang)) return res.status(400).json({ error: 'Invalid lang' });

    const cfg = PC[newLang];
    const targetLevel = req.body.level != null ? +req.body.level : g.level;
    if (req.body.level != null) {
      const lv = +req.body.level;
      if (isNaN(lv) || lv < 1 || lv > cfg.levels) return res.status(400).json({ error: `Level must be between 1 and ${cfg.levels}` });
      g.level = lv;
    }

    const maxDim = getLessonsInLevel(newLang, targetLevel);
    if (req.body.doneInLevel != null) {
      const dim = +req.body.doneInLevel;
      if (isNaN(dim) || dim < 0 || dim > maxDim) return res.status(400).json({ error: `doneInLevel must be between 0 and ${maxDim}` });
      g.doneInLevel = dim;
    }

    if (req.body.students != null) {
      const st = +req.body.students;
      if (isNaN(st) || st < 1 || st > 25) return res.status(400).json({ error: 'A group must have between 1 and 25 students' });
      g.students = st;
    }

    const newStart = req.body.start ?? g.start;
    const newExam = req.body.exam ?? g.exam;
    if (req.body.start != null || req.body.exam != null) {
      const dStart = new Date(newStart);
      const dExam = new Date(newExam);
      if (isNaN(dStart.getTime()) || isNaN(dExam.getTime())) return res.status(400).json({ error: 'Invalid start or exam date' });
      if (dExam <= dStart) return res.status(400).json({ error: 'exam must be after start' });
      if (req.body.start != null) g.start = req.body.start;
      if (req.body.exam != null) g.exam = req.body.exam;
    }

    if (req.body.group != null) g.group = String(req.body.group).trim();
    if (req.body.lang != null) g.lang = req.body.lang;
    if (req.body.startTime != null) g.startTime = req.body.startTime;
    if (req.body.endTime != null) g.endTime = req.body.endTime;
    if (req.body.days != null) g.days = req.body.days;
    if (req.body.autoProgress != null) g.autoProgress = !!req.body.autoProgress;

    await g.save();
    res.json(g.toJSON());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/groups/:id', auth, async (req, res) => {
  try {
    const g = await Group.findById(req.params.id);
    if (!g) return res.status(404).json({ error: 'Group not found' });
    if (req.user.role === 'teacher' && g.tid !== req.user.tid) return res.status(403).json({ error: 'Forbidden' });
    await g.deleteOne(); res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/groups/bulk-delete', auth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array required' });

    const filter = { _id: { $in: ids } };
    if (req.user.role === 'teacher') filter.tid = req.user.tid;

    const result = await Group.deleteMany(filter);
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/stats', auth, adminOnly, async (_req, res) => {
  try {
    const allGroups = await Group.find({ archived: { $ne: true } });
    const doneFn = g => totalDone(g.lang, g.level, g.doneInLevel);
    const totalFn = g => totalLessons(g.lang);
    const avgProgress = allGroups.length ? Math.round(allGroups.reduce((a, g) => a + doneFn(g) / totalFn(g) * 100, 0) / allGroups.length) : 0;
    const byLang = validLangs.map(lang => {
      const gs = allGroups.filter(g => g.lang === lang);
      return { lang, groups: gs.length, students: gs.reduce((a, g) => a + g.students, 0), avgPct: gs.length ? Math.round(gs.reduce((a, g) => a + doneFn(g) / totalFn(g) * 100, 0) / gs.length) : 0 };
    });
    res.json({ totalGroups: allGroups.length, totalTeachers: await Teacher.countDocuments(), totalStudents: allGroups.reduce((a, g) => a + g.students, 0), avgProgress, byLang });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GOOGLE SHEETS LIVE SYNC ENDPOINTS ─────────────────────────
const SYNC_KEY = process.env.SYNC_KEY || 'edutrack_sync_2026';

function computeElapsedLessons(startDateStr, daysSchedule) {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start > today) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= today) {
    const dow = cursor.getDay();
    if (dow !== 0) {
      if (daysSchedule === 'Odd Days' && [1, 3, 5].includes(dow)) count++;
      else if (daysSchedule === 'Even Days' && [2, 4, 6].includes(dow)) count++;
      else if (daysSchedule === 'Every Day') count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function autoProgressGroup(group) {
  const elapsed = computeElapsedLessons(group.start, group.days);
  const maxLevels = PC[group.lang]?.levels || 1;
  const tl = totalLessons(group.lang);
  if (elapsed === 0) {
    return {
      level: group.level,
      doneInLevel: group.doneInLevel,
      totalDone: totalDone(group.lang, group.level, group.doneInLevel),
    };
  }
  const effectiveElapsed = Math.min(tl, elapsed);
  let remaining = effectiveElapsed;
  let curLevel = 1;
  let curDoneInLevel = 0;
  for (let i = 1; i <= maxLevels; i++) {
    const lpl = getLessonsInLevel(group.lang, i);
    if (remaining <= lpl) {
      curLevel = i;
      curDoneInLevel = remaining;
      break;
    } else {
      remaining -= lpl;
      if (i === maxLevels) {
        curLevel = maxLevels;
        curDoneInLevel = lpl;
      }
    }
  }
  return {
    level: curLevel,
    doneInLevel: curDoneInLevel,
    totalDone: effectiveElapsed,
  };
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function verifySyncKey(req, res, next) {
  const key = req.query.key || req.headers['x-sync-key'];
  if (key !== SYNC_KEY) {
    return res.status(401).send('Unauthorized: Invalid or missing sync key');
  }
  next();
}

app.get('/api/sync/config', auth, adminOnly, (req, res) => {
  const host = req.get('host');
  const proto = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const baseUrl = `${proto}://${host}`;
  res.json({
    syncKey: SYNC_KEY,
    urls: {
      students: `${baseUrl}/api/sync/students?key=${SYNC_KEY}`,
      teachers: `${baseUrl}/api/sync/teachers?key=${SYNC_KEY}`,
      courses: `${baseUrl}/api/sync/courses?key=${SYNC_KEY}`,
    }
  });
});

app.get('/api/sync/students', verifySyncKey, async (_req, res) => {
  try {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const [groups, teachers] = await Promise.all([
      Group.find({ archived: { $ne: true } }),
      Teacher.find(),
    ]);

    const teacherMap = Object.fromEntries(teachers.map(t => [t._id.toString(), t.name]));

    const headers = [
      'Group Name',
      'Teacher',
      'Subject / Course',
      'Department / Category',
      'Current Stage (Subject & Level)',
      'Current Level',
      'Max Levels in Course',
      'Level Progress (Done/Total in Level)',
      'Total Course Lessons Done',
      'Total Course Lessons',
      'Overall Completion Rate (%)',
      'Schedule Mode',
      'Time Slot',
      'Start Date',
      'Exam Date',
      'Days Until Exam',
      'Status'
    ];

    const rows = groups.map(g => {
      const isAuto = g.autoProgress === true;
      const auto = isAuto ? autoProgressGroup(g) : null;
      const curLevel = isAuto ? auto.level : g.level;
      const curDoneInLevel = isAuto ? auto.doneInLevel : g.doneInLevel;
      const done = isAuto ? auto.totalDone : totalDone(g.lang, g.level, g.doneInLevel);
      const tl = totalLessons(g.lang);
      const progressPct = tl ? Math.min(100, Math.round((done / tl) * 100)) : 0;
      const cfg = PC[g.lang] || { levels: 1, category: 'General' };
      const maxLevelLessons = getLessonsInLevel(g.lang, curLevel);

      const currentStageName = `${g.lang} - Level ${curLevel} of ${cfg.levels}`;
      const levelProgressText = `${curDoneInLevel} / ${maxLevelLessons} lessons`;

      let daysRemaining = 'N/A';
      let status = 'In Progress';

      if (g.exam) {
        const examDate = new Date(g.exam);
        examDate.setHours(0, 0, 0, 0);
        const diffTime = examDate.getTime() - todayDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        daysRemaining = diffDays >= 0 ? `${diffDays} days` : `Passed (${Math.abs(diffDays)}d ago)`;

        if (progressPct === 100) {
          status = 'Graduated / Completed';
        } else if (diffDays <= 7 && diffDays >= 0) {
          status = 'Graduating Soon (Exam in <7d)';
        } else if (diffDays < 0) {
          status = 'Exam Date Passed';
        }
      }

      return [
        escapeCSV(g.group),
        escapeCSV(teacherMap[g.tid] || 'Unknown Teacher'),
        escapeCSV(g.lang),
        escapeCSV(cfg.category || '-'),
        escapeCSV(currentStageName),
        curLevel,
        cfg.levels || 1,
        escapeCSV(levelProgressText),
        done,
        tl,
        `="${progressPct}%"`,
        escapeCSV(g.days || 'Every Day'),
        escapeCSV(`${g.startTime || '–'} - ${g.endTime || '–'}`),
        escapeCSV(g.start ? ` ${g.start}` : '-'),
        escapeCSV(g.exam ? ` ${g.exam}` : '-'),
        escapeCSV(daysRemaining),
        escapeCSV(status)
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(csvContent);
  } catch (err) { res.status(500).send('Error generating sync data: ' + err.message); }
});

app.get('/api/sync/teachers', verifySyncKey, async (_req, res) => {
  try {
    const [groups, teachers] = await Promise.all([
      Group.find({ archived: { $ne: true } }),
      Teacher.find(),
    ]);

    const calculateHours = g => {
      const isKids = g.lang === 'Python (Kids)' || g.lang === 'Scratch';
      const h = isKids ? 1.5 : 2.0;
      const s = g.days === 'Every Day' ? 6 : 3;
      return h * s;
    };

    const headers = [
      'Teacher Name',
      'Username',
      'Subject Categories',
      'Active Groups Count',
      'Total Students',
      'Weekly Teaching Hours (hrs/wk)',
      'Groups Summary (Group Name | Subject & Current Level | Schedule | Time Slot | Students)'
    ];

    const rows = teachers.map(teacher => {
      const tGroups = groups.filter(g => g.tid === teacher._id.toString());
      const totalStudents = tGroups.reduce((sum, g) => sum + (g.students || 0), 0);
      const weeklyHours = tGroups.reduce((sum, g) => sum + calculateHours(g), 0);
      const subjects = Array.isArray(teacher.subject) ? teacher.subject.join(', ') : (teacher.subject || '-');

      const groupsSummary = tGroups.map(g => {
        const isAuto = g.autoProgress === true;
        const auto = isAuto ? autoProgressGroup(g) : null;
        const curLevel = isAuto ? auto.level : g.level;
        const cfg = PC[g.lang] || { levels: 1 };
        return `${g.group} [${g.lang} (Level ${curLevel}/${cfg.levels}) | ${g.days} | ${g.startTime || '–'}-${g.endTime || '–'} | ${g.students} std]`;
      }).join('; ');

      return [
        escapeCSV(teacher.name),
        escapeCSV(teacher.username),
        escapeCSV(subjects),
        tGroups.length,
        totalStudents,
        weeklyHours.toFixed(1),
        escapeCSV(groupsSummary || 'No active groups')
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(csvContent);
  } catch (err) { res.status(500).send('Error generating sync data: ' + err.message); }
});

app.get('/api/sync/courses', verifySyncKey, async (_req, res) => {
  try {
    const groups = await Group.find({ archived: { $ne: true } });

    const headers = [
      'Department / Category',
      'Course / Subject',
      'Course Levels (Months)',
      'Total Course Lessons',
      'Active Groups Count',
      'Active Students Count',
      'Current Level Breakdown',
      'Average Course Progress (%)',
      'Performance Status'
    ];

    const rows = [];
    const MODULE_LIST = {
      'Web Development': ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React JS', 'Node JS', 'Web Prompt'],
      'IT Kids': ['Python (Kids)', 'Scratch'],
      'Computer Literacy': ['Computer Literacy'],
      'Graphic Design': ['Graphic Design'],
      'Cyber Security': ['Cyber Security'],
      'Python Backend': ['Python Backend'],
      'AI': ['AI'],
      'Prompt Engineering': ['Prompt Engineering'],
      'SMM': ['Marketing', 'Mobilography'],
    };

    Object.entries(MODULE_LIST).forEach(([category, courses]) => {
      courses.forEach(lang => {
        const gs = groups.filter(g => g.lang === lang);
        const totalStudents = gs.reduce((s, g) => s + (g.students || 0), 0);
        const cfg = PC[lang] || { levels: 1 };
        const tl = totalLessons(lang);

        const avgPct = gs.length
          ? Math.round(gs.reduce((s, g) => {
              const isAuto = g.autoProgress === true;
              const auto = isAuto ? autoProgressGroup(g) : null;
              const done = isAuto ? auto.totalDone : totalDone(g.lang, g.level, g.doneInLevel);
              return s + (tl ? (done / tl) * 100 : 0);
            }, 0) / gs.length)
          : 0;

        const levelCounts = {};
        gs.forEach(g => {
          const isAuto = g.autoProgress === true;
          const auto = isAuto ? autoProgressGroup(g) : null;
          const curLevel = isAuto ? auto.level : g.level;
          levelCounts[curLevel] = (levelCounts[curLevel] || 0) + 1;
        });
        const breakdownStr = gs.length
          ? Object.entries(levelCounts).map(([lv, count]) => `${count} in Lv${lv}`).join(', ')
          : 'None';

        let perfLevel = 'No Active Groups';
        if (gs.length > 0) {
          if (avgPct >= 80) perfLevel = 'High (Near Completion)';
          else if (avgPct >= 40) perfLevel = 'Moderate (Mid-Course)';
          else perfLevel = 'Early Stage (0-39%)';
        }

        rows.push([
          escapeCSV(category),
          escapeCSV(lang),
          escapeCSV(`${cfg.levels || 1} Levels (${cfg.levels || 1} Mos)`),
          escapeCSV(`${tl} lessons`),
          gs.length,
          totalStudents,
          escapeCSV(breakdownStr),
          gs.length ? `${avgPct}%` : '0%',
          escapeCSV(perfLevel)
        ].join(','));
      });
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(csvContent);
  } catch (err) { res.status(500).send('Error generating sync data: ' + err.message); }
});

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });

module.exports = app;
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}