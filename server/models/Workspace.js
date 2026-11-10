const mongoose = require('mongoose');

const slugify = (value) => String(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60)
  .replace(/-+$/g, '');

const workspaceSchema = new mongoose.Schema(
  {
    seedTag: { type: String, default: undefined, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 60 },
    owner: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    isPersonal: { type: Boolean, default: false },
  },
  { timestamps: true }
);

workspaceSchema.index({ slug: 1 }, { unique: true });

workspaceSchema.pre('validate', async function () {
  const base = slugify(this.slug || this.name) || 'workspace';
  let slug = base;
  let suffix = 1;
  while (await this.constructor.exists({ slug, _id: { $ne: this._id } })) {
    const ending = `-${suffix}`;
    slug = `${base.slice(0, 60 - ending.length).replace(/-+$/g, '')}${ending}`;
    suffix += 1;
  }
  this.slug = slug;
});

workspaceSchema.virtual('personal').get(function () {
  return this.isPersonal;
});
workspaceSchema.virtual('personal').set(function (value) {
  this.isPersonal = value;
});

module.exports = mongoose.model('Workspace', workspaceSchema);
