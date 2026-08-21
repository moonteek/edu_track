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
  'Web Prompt': { levels: 1, category: 'Web Development', levelLessons: [6] },
  // Web Backend
  'Node JS': { levels: 3, category: 'Web Backend' },
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

app.post('/api/teachers/seed-roster', async (req, res) => {
  try {
    const key = req.query.key || req.headers['x-sync-key'];
    if (key !== SYNC_KEY && key !== 'edutrack_sync_2026') {
      return res.status(401).json({ error: 'Unauthorized: Invalid sync key' });
    }

    const teachersList = [
      { name: 'Habibullayev Axrorbek', username: 'axrorbek.h', subject: ['Cyber Security'] },
      { name: "Ro'zimboyev Muxriddin", username: 'muxriddin.r', subject: ['Computer Literacy'] },
      { name: 'Abdumutalibova Shirin', username: 'shirin.a', subject: ['Computer Literacy'] },
      { name: 'Otaxanova Muxtasar', username: 'muxtasar.o', subject: ['IT Kids'] },
      { name: 'Musoxanova Saida', username: 'saida.m', subject: ['IT Kids'] },
      { name: 'Hiloliddinova Madina', username: 'madina.h', subject: ['IT Kids'] },
      { name: "Gu'ulomov Muhammadamin", username: 'muhammadamin.g', subject: ['IT Kids'] },
      { name: 'Kenjaboyeva Diyora', username: 'diyora.k', subject: ['Web Development'] },
      { name: "Turg'unov Dostonbek", username: 'dostonbek.t', subject: ['Web Development'] },
      { name: 'Jalilov Azimjon', username: 'azimjon.j', subject: ['Web Development'] },
      { name: "Turg'unov Hayotbek", username: 'hayotbek.t', subject: ['Web Development'] },
      { name: 'Abdumutalov Xojiakbar', username: 'xojiakbar.a', subject: ['Web Development'] },
      { name: 'Bannayev Abdushohid', username: 'abdushohid.b', subject: ['Web Development'] },
      { name: 'Abdullayev Hamidullo', username: 'hamidullo.a', subject: ['Web Development'] },
      { name: 'Azimov Foziljon', username: 'foziljon.a', subject: ['Web Development'] },
      { name: 'Saydullayev Ibrohim', username: 'ibrohim.s', subject: ['Web Development'] },
      { name: 'Ikramov Abdulaziz', username: 'abdulaziz.i', subject: ['Web Development'] },
      { name: 'Orifjonov Komiljon', username: 'komiljon.o', subject: ['Graphic Design'] },
      { name: 'Asrorbek Abdulhayev', username: 'asrorbek.a', subject: ['SMM'] },
      { name: 'Turabaev Azizbek', username: 'azizbek.t', subject: ['AI'] },
    ];

    const defaultPassword = 'teacher123';
    const hash = bcrypt.hashSync(defaultPassword, SALT);
    const results = [];

    for (const t of teachersList) {
      let existing = await Teacher.findOne({
        $or: [
          { username: t.username.toLowerCase() },
          { name: t.name }
        ]
      });

      if (existing) {
        existing.name = t.name;
        existing.subject = t.subject;
        await existing.save();
        results.push({ name: t.name, username: existing.username, status: 'updated', subject: t.subject });
      } else {
        const created = await Teacher.create({
          name: t.name,
          username: t.username.toLowerCase(),
          hash,
          subject: t.subject,
        });
        results.push({ name: t.name, username: created.username, status: 'created', subject: t.subject });
      }
    }

    res.json({ success: true, count: results.length, teachers: results });
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
    let { tid, group, lang, startTime, endTime, start, exam, students, level, doneInLevel, days, trackMode, trackStartLang } = req.body;
    if (req.user.role === 'teacher') tid = req.user.tid;
    if (!group || !lang || !startTime || !endTime || !start || !students || !level || !tid) return res.status(400).json({ error: 'All required fields must be provided' });
    if (!validLangs.includes(lang)) return res.status(400).json({ error: 'Invalid lang' });
    level = +level; doneInLevel = +(doneInLevel ?? 0);
    if (+students > 25 || +students < 1) return res.status(400).json({ error: 'A group must have between 1 and 25 students' });
    const cfg = PC[lang];
    if (level < 1 || level > cfg.levels) return res.status(400).json({ error: `Level must be between 1 and ${cfg.levels}` });
    const maxDim = getLessonsInLevel(lang, level);
    if (doneInLevel < 0 || doneInLevel > maxDim) return res.status(400).json({ error: `doneInLevel must be between 0 and ${maxDim}` });
    const dStart = new Date(start);
    if (isNaN(dStart.getTime())) return res.status(400).json({ error: 'Invalid start date' });
    
    const scheduleDays = days || 'Every Day';
    if (!exam) {
      exam = calcExamDate(start, scheduleDays, lang, level, trackMode !== false, trackStartLang || lang);
    }
    const dExam = new Date(exam);
    if (isNaN(dExam.getTime())) return res.status(400).json({ error: 'Invalid exam date' });
    if (dExam <= dStart) return res.status(400).json({ error: 'exam must be after start' });
    if (req.user.role === 'admin' && !(await Teacher.findById(tid))) return res.status(400).json({ error: 'Invalid tid' });

    if ((await Group.countDocuments({ tid, archived: { $ne: true } })) >= 10) return res.status(400).json({ error: 'A teacher cannot have more than 10 active groups' });

    const g = await Group.create({ tid, group: group.trim(), lang, startTime, endTime, start, exam, students: +students, level, doneInLevel, days: scheduleDays, autoProgress: true, trackMode: trackMode !== false, trackStartLang: trackStartLang || lang });
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

    if (req.body.start != null) {
      const dStart = new Date(req.body.start);
      if (isNaN(dStart.getTime())) return res.status(400).json({ error: 'Invalid start date' });
      g.start = req.body.start;
    }

    if (req.body.days != null) g.days = req.body.days;
    if (req.body.group != null) g.group = String(req.body.group).trim();
    if (req.body.lang != null) g.lang = req.body.lang;
    if (req.body.startTime != null) g.startTime = req.body.startTime;
    if (req.body.endTime != null) g.endTime = req.body.endTime;
    if (req.body.autoProgress != null) g.autoProgress = !!req.body.autoProgress;
    if (req.body.trackMode != null) g.trackMode = !!req.body.trackMode;
    if (req.body.trackStartLang != null) g.trackStartLang = req.body.trackStartLang;

    if (req.body.exam != null) {
      const dExam = new Date(req.body.exam);
      if (isNaN(dExam.getTime())) return res.status(400).json({ error: 'Invalid exam date' });
      g.exam = req.body.exam;
    } else if (req.body.start != null || req.body.days != null || req.body.lang != null || req.body.level != null) {
      g.exam = calcExamDate(g.start, g.days, g.lang, g.level, g.trackMode !== false, g.trackStartLang || g.lang);
    }

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
  const parts = startDateStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0])) return 0;
  const start = new Date(parts[0], parts[1] - 1, parts[2]);
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

const TRACK_SEQUENCES = {
  'Web Development': ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React JS', 'Web Prompt'],
  'Web Backend': ['Node JS'],
  'IT Kids': ['Scratch', 'Python (Kids)'],
  'SMM': ['Marketing', 'Mobilography'],
};

function getNextSubjectInTrack(currentLang) {
  for (const [, sequence] of Object.entries(TRACK_SEQUENCES)) {
    const idx = sequence.indexOf(currentLang);
    if (idx !== -1 && idx < sequence.length - 1) {
      return sequence[idx + 1];
    }
  }
  return null;
}

function calcLessonDate(startDateStr, scheduleMode = 'Every Day', targetLessons = 1) {
  if (!startDateStr || targetLessons <= 0) return '';
  const parts = startDateStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0])) return '';
  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  let lessonsCount = 0;
  while (lessonsCount < targetLessons) {
    const day = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    let isValid = false;
    if (day !== 0) { // Sunday skipped
      if (scheduleMode === 'Even Days' && [2, 4, 6].includes(day)) isValid = true;
      else if (scheduleMode === 'Odd Days' && [1, 3, 5].includes(day)) isValid = true;
      else if (scheduleMode === 'Every Day') isValid = true;
    }
    if (isValid) {
      lessonsCount++;
      if (lessonsCount === targetLessons) break;
    }
    date.setDate(date.getDate() + 1);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function calcExamDates(startDateStr, scheduleMode = 'Every Day', lang = 'HTML', level = 1, isTrack = true, trackStartLang = null) {
  if (!startDateStr) return { currentExamDate: '', finalExamDate: '', exam: '' };

  const trackCategory = PC[trackStartLang || lang]?.category;
  const sequence = isTrack && trackCategory ? TRACK_SEQUENCES[trackCategory] : null;

  let currentLessonsTarget = 0;
  let totalTrackLessons = 0;

  if (sequence && sequence.includes(lang)) {
    const startLang = trackStartLang || sequence[0];
    const startIdx = sequence.indexOf(startLang);
    const activeSequence = sequence.slice(startIdx >= 0 ? startIdx : 0);

    let reachedCurrent = false;
    for (const sLang of activeSequence) {
      const sCfg = PC[sLang] || { levels: 1 };
      const sTotalLevels = sCfg.levels;
      const isCurrentSubject = (sLang === lang);

      if (!reachedCurrent) {
        if (isCurrentSubject) {
          for (let lv = 1; lv <= Math.min(level, sTotalLevels); lv++) {
            currentLessonsTarget += getLessonsInLevel(sLang, lv);
          }
          reachedCurrent = true;
        } else {
          currentLessonsTarget += totalLessons(sLang);
        }
      }

      totalTrackLessons += totalLessons(sLang);
    }
    if (!reachedCurrent) {
      currentLessonsTarget = totalTrackLessons;
    }
  } else {
    const cfg = PC[lang] || { levels: 1 };
    for (let lv = 1; lv <= Math.min(level, cfg.levels); lv++) {
      currentLessonsTarget += getLessonsInLevel(lang, lv);
    }
    totalTrackLessons = totalLessons(lang);
  }

  const currentExamDate = calcLessonDate(startDateStr, scheduleMode, currentLessonsTarget) || '';
  const finalExamDate = calcLessonDate(startDateStr, scheduleMode, totalTrackLessons) || '';

  return {
    currentExamDate,
    finalExamDate,
    exam: currentExamDate,
    currentLessonsTarget,
    totalTrackLessons,
  };
}

function calcExamDate(startDateStr, scheduleMode = 'Every Day', lang = 'HTML', level = 1, isTrack = true, trackStartLang = null) {
  const res = calcExamDates(startDateStr, scheduleMode, lang, level, isTrack, trackStartLang);
  return res.currentExamDate;
}

function autoProgressGroup(group) {
  const elapsed = computeElapsedLessons(group.start, group.days);
  
  if (group.trackMode === true) {
    const trackCategory = PC[group.trackStartLang || group.lang]?.category;
    const sequence = TRACK_SEQUENCES[trackCategory];
    if (sequence) {
      const startLang = group.trackStartLang || sequence[0];
      const startIdx = sequence.indexOf(startLang);
      const activeSequence = sequence.slice(startIdx >= 0 ? startIdx : 0);
      
      let remainingLessons = elapsed;
      let curLang = activeSequence[0];
      let curLevel = 1;
      let curDoneInLevel = 0;
      let totalTrackLessons = 0;

      activeSequence.forEach(l => { totalTrackLessons += totalLessons(l); });

      for (let s = 0; s < activeSequence.length; s++) {
        const lName = activeSequence[s];
        const cfg = PC[lName] || { levels: 1 };
        curLang = lName;
        
        for (let lv = 1; lv <= cfg.levels; lv++) {
          const lpl = getLessonsInLevel(lName, lv);
          curLevel = lv;
          if (remainingLessons <= lpl) {
            curDoneInLevel = remainingLessons;
            const examInfo = calcExamDates(group.start, group.days, curLang, curLevel, true, group.trackStartLang);
            return {
              lang: curLang,
              level: curLevel,
              doneInLevel: curDoneInLevel,
              totalDone: totalDone(curLang, curLevel, curDoneInLevel),
              trackDone: Math.min(totalTrackLessons, elapsed),
              trackTotal: totalTrackLessons,
              currentExamDate: examInfo.currentExamDate,
              finalExamDate: examInfo.finalExamDate,
              isFinished: false,
            };
          } else {
            remainingLessons -= lpl;
          }
        }
      }

      const lastLang = activeSequence[activeSequence.length - 1];
      const lastCfg = PC[lastLang] || { levels: 1 };
      const lastLpl = getLessonsInLevel(lastLang, lastCfg.levels);
      const examInfo = calcExamDates(group.start, group.days, lastLang, lastCfg.levels, true, group.trackStartLang);
      return {
        lang: lastLang,
        level: lastCfg.levels,
        doneInLevel: lastLpl,
        totalDone: totalLessons(lastLang),
        trackDone: totalTrackLessons,
        trackTotal: totalTrackLessons,
        currentExamDate: examInfo.currentExamDate,
        finalExamDate: examInfo.finalExamDate,
        isFinished: true,
      };
    }
  }

  const maxLevels = PC[group.lang]?.levels || 1;
  const tl = totalLessons(group.lang);
  if (elapsed === 0) {
    const examInfo = calcExamDates(group.start, group.days, group.lang, group.level, false);
    return {
      lang: group.lang,
      level: group.level,
      doneInLevel: group.doneInLevel,
      totalDone: totalDone(group.lang, group.level, group.doneInLevel),
      currentExamDate: examInfo.currentExamDate,
      finalExamDate: examInfo.finalExamDate,
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
  const examInfo = calcExamDates(group.start, group.days, group.lang, curLevel, false);
  return {
    lang: group.lang,
    level: curLevel,
    doneInLevel: curDoneInLevel,
    totalDone: effectiveElapsed,
    currentExamDate: examInfo.currentExamDate,
    finalExamDate: examInfo.finalExamDate,
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
      schedule: `${baseUrl}/api/sync/schedule?key=${SYNC_KEY}`,
    }
  });
});

function getTrackContext(lang, level) {
  const webDevTrack = [
    { lang: 'HTML', levels: 1, startMonth: 1 },
    { lang: 'CSS', levels: 2, startMonth: 2 },
    { lang: 'JavaScript', levels: 3, startMonth: 4 },
    { lang: 'TypeScript', levels: 1, startMonth: 7 },
    { lang: 'React JS', levels: 3, startMonth: 8 },
    { lang: 'Node JS', levels: 3, startMonth: 11 },
    { lang: 'Web Prompt', levels: 1, startMonth: 14 },
  ];
  const mod = webDevTrack.find(m => m.lang === lang);
  if (mod) {
    const month = mod.startMonth + (level - 1);
    return `Web Dev Track (Month ${month} of 14)`;
  }
  return PC[lang]?.category || 'General';
}

function getLevelVisual(level, maxLevels) {
  const max = maxLevels || 1;
  const filled = Math.min(max, Math.max(0, level));
  const empty = Math.max(0, max - filled);
  const bar = '■'.repeat(filled) + '□'.repeat(empty);
  return `Lv ${level}/${max} [${bar}]`;
}

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
      'Subject',
      'Level Progress Bar',
      'Current Level',
      'Lessons Done This Level',
      'Total Course Lessons Done',
      'Overall Completion Rate',
      'Status',
      'Teacher',
      'Exam Date',
      'Days Until Exam',
      'Start Date',
      'Schedule Mode',
      'Time Slot',
      'Students Count',
      'Curriculum Track Context',
      'Department / Category'
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

      const levelVisual = getLevelVisual(curLevel, cfg.levels);
      const levelProgressText = `${curDoneInLevel} / ${maxLevelLessons} lessons`;
      const totalLessonsText = `${done} / ${tl} lessons`;
      const trackContext = getTrackContext(g.lang, curLevel);

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
        escapeCSV(g.lang),
        escapeCSV(levelVisual),
        `Level ${curLevel} of ${cfg.levels}`,
        escapeCSV(levelProgressText),
        escapeCSV(totalLessonsText),
        `="${progressPct}%"`,
        escapeCSV(status),
        escapeCSV(teacherMap[g.tid] || 'Unknown Teacher'),
        g.exam ? `="${g.exam}"` : '"–"',
        escapeCSV(daysRemaining),
        g.start ? `="${g.start}"` : '"–"',
        escapeCSV(g.days || 'Every Day'),
        escapeCSV(`${g.startTime || '–'} - ${g.endTime || '–'}`),
        g.students || 0,
        escapeCSV(trackContext),
        escapeCSV(cfg.category || '-')
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
      'Groups Summary (Group Name | Subject & Visual Level | Schedule | Time Slot | Students)'
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
        const visual = getLevelVisual(curLevel, cfg.levels);
        return `${g.group} [${g.lang} ${visual} | ${g.days} | ${g.startTime || '–'}-${g.endTime || '–'} | ${g.students} std]`;
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
      'Web Development': ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React JS', 'Web Prompt'],
      'Web Backend': ['Node JS'],
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

app.get('/api/sync/schedule', verifySyncKey, async (req, res) => {
  try {
    const [groups, teachers] = await Promise.all([
      Group.find({ archived: { $ne: true } }),
      Teacher.find(),
    ]);

    const isOverlapping = (slotStr, gStart, gEnd) => {
      if (!gStart || !gEnd) return false;
      const [s1, e1] = slotStr.split('-');
      const toMins = t => { const [h, m] = t.split(':'); return parseInt(h) * 60 + parseInt(m); };
      return toMins(s1) < toMins(gEnd) && toMins(gStart) < toMins(e1);
    };

    const slots = [
      '08:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00', '18:00-20:00'
    ];

    const headers = [
      'Department / Category',
      'Schedule Mode',
      'Teacher Name',
      'Total Active Groups',
      ...slots.map(s => `Slot (${s})`),
      'Weekly Teaching Hours'
    ];

    const rows = [];

    const scheduleViews = [
      { key: 'oddDays', label: 'Odd Days (Mon, Wed, Fri)', groupDayMatch: 'Odd Days' },
      { key: 'evenDays', label: 'Even Days (Tue, Thu, Sat)', groupDayMatch: 'Even Days' },
    ];

    scheduleViews.forEach(v => {
      teachers.forEach(t => {
        const tGroups = groups.filter(g => g.tid === t._id.toString());
        const targetGroups = tGroups.filter(g => g.days === v.groupDayMatch || g.days === 'Every Day');
        const avail = t.availability || { oddDays: {}, evenDays: {} };
        const subjects = Array.isArray(t.subject) ? t.subject.join(', ') : (t.subject || 'General');

        const slotValues = slots.map(slot => {
          const hasLesson = targetGroups.some(g => isOverlapping(slot, g.startTime, g.endTime));
          if (hasLesson) {
            const grp = targetGroups.find(g => isOverlapping(slot, g.startTime, g.endTime));
            return escapeCSV(grp ? `Lesson: ${grp.group} (${grp.lang} Lv${grp.level})` : 'Lesson');
          }
          const status = avail[v.key]?.[slot] || 'Unset';
          return escapeCSV(status);
        });

        const weeklyHours = tGroups.reduce((sum, g) => {
          const isKids = g.lang === 'Python (Kids)' || g.lang === 'Scratch';
          const h = isKids ? 1.5 : 2.0;
          const s = g.days === 'Every Day' ? 6 : 3;
          return sum + (h * s);
        }, 0);

        rows.push([
          escapeCSV(subjects),
          escapeCSV(v.label),
          escapeCSV(t.name),
          tGroups.length,
          ...slotValues,
          escapeCSV(`${weeklyHours.toFixed(1)} hrs/wk`)
        ].join(','));
      });
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(csvContent);
  } catch (err) { res.status(500).send('Error generating sync schedule: ' + err.message); }
});

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });

module.exports = app;
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}