const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  hash: { type: String, required: true, select: false },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform(_doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id; delete ret.__v; delete ret.hash;
      return ret;
    },
  },
});

if (mongoose.models.Admin) mongoose.deleteModel('Admin');
module.exports = mongoose.model('Admin', schema);
