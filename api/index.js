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
// Start seed process in the background immediately
connectDB().then(() => seed()).catch(console.error);

app.use(async (req, _res, next) => {
  // Admin auth doesn't need MongoDB - skip DB connection for it
  if (req.path === '/api/auth/admin') return next();
  try {
    await connectDB();
    next();
  }
  catch (err) { next(err); }
});

const SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const SALT = 10;
const PC = {
  // Web Development
  'HTML': { levels: 1, category: 'Web Development' },
  'CSS': { levels: 2, category: 'Web Development' },
  'JavaScript': { levels: 3, category: 'Web Development' },
  'React JS': { levels: 3, category: 'Web Development' },
  'Node JS': { levels: 3, category: 'Web Development' },
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

app.get('/', (_req, res) => res.json({ message: 'EduTrack API Backend is running' }));
app.get('/api', (_req, res) => res.json({ status: 'ok', message: 'EduTrack API running' }));

app.post('/api/auth/admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      if (username === ADMIN_USER && password === ADMIN_PASS) {
        return res.json({ token: issueToken({ role: 'admin' }) });
      }
    }
    
    const dbAdmin = await Admin.findOne({ username }).select('+hash');
    if (!dbAdmin || !bcrypt.compareSync(password, dbAdmin.hash)) {
      if (username === ADMIN_USER && password === ADMIN_PASS) {
        return res.json({ token: issueToken({ role: 'admin' }) });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json({ token: issueToken({ role: 'admin' }) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/teacher', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const teacher = await Teacher.findOne({ username }).select('+hash');
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
    const { name, username, password } = req.body;
    let subject = req.body.subject;
    // Normalize to array
    if (typeof subject === 'string') subject = [subject];
    if (!name || !username || !password || !subject || !subject.length) return res.status(400).json({ error: 'name, username, password, subject required' });
    if (subject.length > 2) return res.status(400).json({ error: 'Maximum 2 specializations allowed' });
    if (await Teacher.findOne({ username })) return res.status(409).json({ error: 'Username already taken' });
    const teacher = await Teacher.create({ name, username, hash: bcrypt.hashSync(password, SALT), subject });
    res.status(201).json(teacher.toJSON());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/teachers/:id', auth, adminOnly, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id).select('+hash');
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    const { name, username, password } = req.body;
    let subject = req.body.subject;
    if (typeof subject === 'string') subject = [subject];
    if (subject && subject.length > 2) return res.status(400).json({ error: 'Maximum 2 specializations allowed' });
    if (username && username !== teacher.username && await Teacher.findOne({ username })) return res.status(409).json({ error: 'Username already taken' });
    if (name) teacher.name = name; if (username) teacher.username = username;
    if (subject && subject.length) teacher.subject = subject; if (password) teacher.hash = bcrypt.hashSync(password, SALT);
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
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
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
    
    const { username, password } = req.body;
    if (username) {
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
    if (+students > 25) return res.status(400).json({ error: 'A group cannot have more than 25 students' });
    const cfg = PC[lang];
    if (level < 1 || level > cfg.levels) return res.status(400).json({ error: 'Invalid level' });
    if (doneInLevel < 0) return res.status(400).json({ error: 'Invalid doneInLevel' });
    if (new Date(exam) <= new Date(start)) return res.status(400).json({ error: 'exam must be after start' });
    if (req.user.role === 'admin' && !(await Teacher.findById(tid))) return res.status(400).json({ error: 'Invalid tid' });

    if ((await Group.countDocuments({ tid })) >= 10) return res.status(400).json({ error: 'A teacher cannot have more than 10 groups' });

    const g = await Group.create({ tid, group, lang, startTime, endTime, start, exam, students: +students, level, doneInLevel, days: days || 'Every Day', autoProgress: true });
    res.status(201).json(g.toJSON());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/groups/:id', auth, async (req, res) => {
  try {
    const g = await Group.findById(req.params.id);
    if (!g) return res.status(404).json({ error: 'Group not found' });
    if (req.user.role === 'teacher' && g.tid !== req.user.tid) return res.status(403).json({ error: 'Forbidden' });
    if (req.body.lang && !validLangs.includes(req.body.lang)) return res.status(400).json({ error: 'Invalid lang' });
    if (req.body.students != null && +req.body.students > 25) return res.status(400).json({ error: 'A group cannot have more than 25 students' });
    for (const f of ['group', 'lang', 'startTime', 'endTime', 'start', 'exam', 'students', 'level', 'doneInLevel', 'days']) if (req.body[f] != null) g[f] = req.body[f];
    g.autoProgress = true;
    await g.save(); res.json(g.toJSON());
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
    const allGroups = await Group.find();
    const doneFn = g => (g.level - 1) * LPL + g.doneInLevel;
    const totalFn = g => (PC[g.lang]?.levels || 1) * LPL;
    const avgProgress = allGroups.length ? Math.round(allGroups.reduce((a, g) => a + doneFn(g) / totalFn(g) * 100, 0) / allGroups.length) : 0;
    const byLang = validLangs.map(lang => {
      const gs = allGroups.filter(g => g.lang === lang);
      return { lang, groups: gs.length, students: gs.reduce((a, g) => a + g.students, 0), avgPct: gs.length ? Math.round(gs.reduce((a, g) => a + doneFn(g) / totalFn(g) * 100, 0) / gs.length) : 0 };
    });
    res.json({ totalGroups: allGroups.length, totalTeachers: await Teacher.countDocuments(), totalStudents: allGroups.reduce((a, g) => a + g.students, 0), avgProgress, byLang });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });

module.exports = app;
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}