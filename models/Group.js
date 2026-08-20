const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tid: { type: String, required: true },
  group: { type: String, required: true, trim: true },
  lang: { type: String, required: true, enum: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React JS', 'Node JS', 'Web Prompt', 'Python (Kids)', 'Scratch', 'Computer Literacy', 'Graphic Design', 'Cyber Security', 'Python Backend', 'AI', 'Prompt Engineering', 'Marketing', 'Mobilography'] },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  start: { type: String, required: true },
  exam: { type: String, required: true },
  students: { type: Number, required: true, min: 1 },
  level: { type: Number, required: true, min: 1 },
  doneInLevel: { type: Number, default: 0, min: 0 },
  days: { type: String, enum: ['Every Day', 'Odd Days', 'Even Days'], default: 'Every Day' },
  autoProgress: { type: Boolean, default: true },
  archived: { type: Boolean, default: false },
  archivedAt: { type: Date, default: null },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform(_doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id; delete ret.__v;
      return ret;
    },
  },
});

schema.index({ tid: 1 });

module.exports = mongoose.models.Group || mongoose.model('Group', schema);