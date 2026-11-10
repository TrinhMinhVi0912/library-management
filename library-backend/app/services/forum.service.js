const slugify = require('slugify');
const sanitizeHtml = require('sanitize-html');
const ApiError = require('../api-error');
const { ForumCategory, ForumThread, ForumPost, ForumReport, Book } = require('../models');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');
const notifyService = require('./notify.service');
const auditService = require('./audit.service');

const htmlOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a'],
  allowedAttributes: { a: ['href', 'title', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener noreferrer' }, true),
  },
};

function cleanContent(content) {
  const cleaned = sanitizeHtml(content || '', htmlOptions).trim();
  if (!cleaned || !sanitizeHtml(cleaned).replace(/<[^>]*>/g, '').trim()) {
    throw ApiError.badRequest('Nội dung không được để trống sau khi làm sạch');
  }
  return cleaned;
}

function assertActiveUser(user) {
  if (!user || user.status !== 'active') throw ApiError.forbidden('Tài khoản bị khóa không thể đăng bài trên diễn đàn');
}

function slugBase(value) {
  return slugify(value, { lower: true, strict: true, locale: 'vi', trim: true }) || `forum-${Date.now()}`;
}

async function uniqueSlug(Model, value, excludeId = null) {
  const base = slugBase(value);
  let candidate = base;
  let suffix = 1;
  while (await Model.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}

async function listCategories() {
  return ForumCategory.find({}).sort({ order: 1, name: 1 }).lean();
}

async function createCategory(data, actor) {
  const category = await ForumCategory.create({
    name: data.name,
    slug: await uniqueSlug(ForumCategory, data.slug || data.name),
    description: data.description || '',
    order: data.order ?? 0,
  });
  await auditService.log({ actor: actor._id, action: 'forum.category.create', targetType: 'ForumCategory', targetId: category._id });
  return category;
}

async function updateCategory(categoryId, data, actor) {
  const category = await ForumCategory.findById(categoryId);
  if (!category) throw ApiError.notFound('Chuyên mục không tồn tại');
  if (data.name !== undefined) category.name = data.name;
  if (data.description !== undefined) category.description = data.description;
  if (data.order !== undefined) category.order = data.order;
  if (data.slug !== undefined || data.name !== undefined) {
    category.slug = await uniqueSlug(ForumCategory, data.slug || data.name || category.name, category._id);
  }
  await category.save();
  await auditService.log({ actor: actor._id, action: 'forum.category.update', targetType: 'ForumCategory', targetId: category._id, detail: { fields: Object.keys(data) } });
  return category;
}

async function deleteCategory(categoryId, actor) {
  const category = await ForumCategory.findById(categoryId);
  if (!category) throw ApiError.notFound('Chuyên mục không tồn tại');
  if (await ForumThread.exists({ category: categoryId })) throw ApiError.conflict('Không thể xóa chuyên mục đang có chủ đề');
  await ForumCategory.deleteOne({ _id: categoryId });
  await auditService.log({ actor: actor._id, action: 'forum.category.delete', targetType: 'ForumCategory', targetId: categoryId });
  return { deleted: true, categoryId };
}

async function createReport(reporter, data) {
  assertActiveUser(reporter);
  let target;
  if (data.targetType === 'thread') {
    target = await ForumThread.exists({ _id: data.targetId, status: 'active' });
  } else {
    const post = await ForumPost.findOne({ _id: data.targetId, status: 'active' }).select('thread').lean();
    target = post && await ForumThread.exists({ _id: post.thread, status: 'active' });
  }
  if (!target) throw ApiError.notFound('Nội dung cần báo cáo không tồn tại');
  const report = await ForumReport.create({
    targetType: data.targetType,
    targetId: data.targetId,
    reporter: reporter._id,
    reason: data.reason,
  });
  await auditService.log({
    actor: reporter._id,
    action: 'forum.report.create',
    targetType: 'ForumReport',
    targetId: report._id,
    detail: { reportedType: report.targetType, reportedId: report.targetId },
  });
  return report;
}

async function getAdminReports(query = {}) {
  const { page, limit, skip, sort } = parsePagination(query, { defaultLimit: 10 });
  const filter = { status: query.status || 'open' };
  if (query.targetType) filter.targetType = query.targetType;
  const [items, total] = await Promise.all([
    ForumReport.find(filter)
      .populate('reporter', 'code firstName lastName avatar')
      .populate('handledBy', 'code firstName lastName role')
      .populate('targetId')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    ForumReport.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(total, page, limit) };
}

async function updateReportStatus(reportId, actor, status) {
  const report = await ForumReport.findById(reportId);
  if (!report) throw ApiError.notFound('Báo cáo không tồn tại');
  if (report.status === status && String(report.handledBy) === String(actor._id)) return report;
  const previousStatus = report.status;
  report.status = status;
  report.handledBy = actor._id;
  await report.save();
  await auditService.log({
    actor: actor._id,
    action: `forum.report.${status}`,
    targetType: 'ForumReport',
    targetId: report._id,
    detail: { previousStatus, status, reportedType: report.targetType, reportedId: report.targetId },
  });
  return report;
}

async function setThreadModeration(threadId, actor, field, value) {
  const thread = await ForumThread.findById(threadId);
  if (!thread) throw ApiError.notFound('Chủ đề không tồn tại');
  if (thread[field] === value) return thread;
  thread[field] = value;
  await thread.save();
  await auditService.log({
    actor: actor._id,
    action: `forum.thread.${field}`,
    targetType: 'ForumThread',
    targetId: thread._id,
    detail: { [field]: value },
  });
  return thread;
}

async function setThreadPinned(threadId, actor, pinned) {
  return setThreadModeration(threadId, actor, 'pinned', pinned);
}

async function setThreadLocked(threadId, actor, locked) {
  return setThreadModeration(threadId, actor, 'locked', locked);
}

async function hideThread(threadId, actor) {
  const thread = await ForumThread.findById(threadId);
  if (!thread) throw ApiError.notFound('Chủ đề không tồn tại');
  if (thread.status !== 'hidden') {
    thread.status = 'hidden';
    await thread.save();
    await auditService.log({ actor: actor._id, action: 'forum.thread.hide', targetType: 'ForumThread', targetId: thread._id });
  }
  await ForumPost.updateMany({ thread: thread._id, status: 'active' }, { $set: { status: 'hidden' } });
  return thread;
}

function threadSort(sort) {
  const sorts = {
    latest: { createdAt: -1 },
    active: { lastReplyAt: -1, createdAt: -1 },
    popular: { replyCount: -1, likeCount: -1, createdAt: -1 },
    views: { viewCount: -1, createdAt: -1 },
  };
  return { pinned: -1, ...(sorts[sort] || sorts.active) };
}

async function listThreads(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { status: 'active' };
  if (query.category) filter.category = query.category;
  if (query.book) filter.book = query.book;
  if (query.q) filter.$or = [{ title: new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { content: new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }];
  const [items, total] = await Promise.all([
    ForumThread.find(filter).populate('category', 'name slug').populate('author', 'firstName lastName avatar role').populate('book', 'title slug cover').sort(threadSort(query.sort)).skip(skip).limit(limit).lean(),
    ForumThread.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(total, page, limit) };
}

async function listMyThreads(user, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { author: user._id };
  if (query.q) {
    const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ title: new RegExp(escaped, 'i') }, { content: new RegExp(escaped, 'i') }];
  }
  const [items, total] = await Promise.all([
    ForumThread.find(filter).populate('category', 'name slug').populate('author', 'firstName lastName avatar role').populate('book', 'title slug cover').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ForumThread.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(total, page, limit) };
}

async function getMyThread(threadId, user) {
  const thread = await ForumThread.findOne({ _id: threadId, author: user._id })
    .populate('category', 'name slug').populate('author', 'firstName lastName avatar role').populate('book', 'title slug cover');
  if (!thread) throw ApiError.notFound('Không tìm thấy bài đăng của bạn');
  return thread;
}

async function getThread(idOrSlug) {
  const filter = /^[0-9a-fA-F]{24}$/.test(idOrSlug) ? { _id: idOrSlug, status: 'active' } : { slug: idOrSlug, status: 'active' };
  const thread = await ForumThread.findOneAndUpdate(filter, { $inc: { viewCount: 1 } }, { new: true })
    .populate('category', 'name slug').populate('author', 'firstName lastName avatar role').populate('book', 'title slug cover');
  if (!thread) throw ApiError.notFound('Chủ đề không tồn tại');
  return thread;
}

async function createThread(user, data) {
  assertActiveUser(user);
  const category = await ForumCategory.exists({ _id: data.category });
  if (!category) throw ApiError.notFound('Chuyên mục không tồn tại');
  if (data.book && !(await Book.exists({ _id: data.book }))) throw ApiError.notFound('Sách không tồn tại');
  const thread = await ForumThread.create({
    category: data.category,
    author: user._id,
    title: data.title,
    slug: await uniqueSlug(ForumThread, data.title),
    content: cleanContent(data.content),
    book: data.book || null,
    tags: data.tags || [],
  });
  return thread;
}

function canManage(record, user) {
  return ['staff', 'admin'].includes(user.role) || String(record.author) === String(user._id);
}

async function updateThread(threadId, user, data) {
  const thread = await ForumThread.findById(threadId);
  if (!thread || thread.status !== 'active') throw ApiError.notFound('Chủ đề không tồn tại');
  if (!canManage(thread, user)) throw ApiError.forbidden('Chỉ chủ bài hoặc nhân viên mới được sửa chủ đề');
  if (data.category && !(await ForumCategory.exists({ _id: data.category }))) throw ApiError.notFound('Chuyên mục không tồn tại');
  if (data.book && !(await Book.exists({ _id: data.book }))) throw ApiError.notFound('Sách không tồn tại');
  for (const field of ['category', 'title', 'book', 'tags']) if (data[field] !== undefined) thread[field] = data[field] || null;
  if (data.content !== undefined) thread.content = cleanContent(data.content);
  if (data.title !== undefined) thread.slug = await uniqueSlug(ForumThread, data.title, thread._id);
  await thread.save();
  return thread;
}

async function deleteThread(threadId, user) {
  const thread = await ForumThread.findById(threadId);
  if (!thread || thread.status !== 'active') throw ApiError.notFound('Chủ đề không tồn tại');
  if (!canManage(thread, user)) throw ApiError.forbidden('Chỉ chủ bài hoặc nhân viên mới được xóa chủ đề');
  thread.status = 'hidden';
  await thread.save();
  await ForumPost.updateMany({ thread: thread._id }, { $set: { status: 'hidden' } });
  await auditService.log({ actor: user._id, action: 'forum.thread.delete', targetType: 'ForumThread', targetId: thread._id });
  return { deleted: true, threadId: thread._id };
}

async function listPosts(threadId, query = {}) {
  const thread = await ForumThread.exists({ _id: threadId, status: 'active' });
  if (!thread) throw ApiError.notFound('Chủ đề không tồn tại');
  const { page, limit, skip } = parsePagination(query);
  const filter = { thread: threadId, status: 'active' };
  const [items, total] = await Promise.all([
    ForumPost.find(filter)
      .populate('author', 'firstName lastName avatar role')
      .populate({ path: 'parent', match: { status: 'active' } })
      .sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
    ForumPost.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(total, page, limit) };
}

async function createPost(threadId, user, data) {
  assertActiveUser(user);
  const thread = await ForumThread.findOne({ _id: threadId, status: 'active' });
  if (!thread) throw ApiError.notFound('Chủ đề không tồn tại');
  if (thread.locked) throw ApiError.conflict('Chủ đề đã khóa, không thể trả lời');
  if (data.parent) {
    const parent = await ForumPost.findOne({ _id: data.parent, thread: threadId, status: 'active' });
    if (!parent) throw ApiError.notFound('Bài trả lời gốc không tồn tại trong chủ đề');
    if (parent.parent) throw ApiError.badRequest('Chỉ hỗ trợ trả lời lồng tối đa một cấp');
  }
  const post = await ForumPost.create({ thread: threadId, author: user._id, parent: data.parent || null, content: cleanContent(data.content) });
  await ForumThread.updateOne({ _id: threadId }, { $inc: { replyCount: 1 }, $set: { lastReplyAt: post.createdAt, lastReplyBy: user._id } });
  if (String(thread.author) !== String(user._id)) {
    await notifyService.notifyUser(thread.author, {
      type: 'forum', title: 'Chủ đề của bạn có trả lời mới',
      content: `Có thành viên vừa trả lời chủ đề “${thread.title}”.`, link: `/forum/threads/${thread.slug}`,
    });
  }
  return post;
}

async function updatePost(postId, user, data) {
  const post = await ForumPost.findById(postId);
  if (!post || post.status !== 'active') throw ApiError.notFound('Bài trả lời không tồn tại');
  if (!canManage(post, user)) throw ApiError.forbidden('Chỉ chủ bài hoặc nhân viên mới được sửa bài trả lời');
  post.content = cleanContent(data.content);
  await post.save();
  return post;
}

async function markPostHidden(post, actor, action) {
  if (post.status === 'hidden') return post;
  post.status = 'hidden';
  await post.save();
  const latestReply = await ForumPost.findOne({ thread: post.thread, status: 'active' }).sort({ createdAt: -1 }).select('createdAt author').lean();
  await ForumThread.updateOne(
    { _id: post.thread, replyCount: { $gt: 0 } },
    { $inc: { replyCount: -1 }, $set: { lastReplyAt: latestReply?.createdAt || null, lastReplyBy: latestReply?.author || null } }
  );
  await auditService.log({ actor: actor._id, action, targetType: 'ForumPost', targetId: post._id, detail: { thread: post.thread } });
  return post;
}

async function deletePost(postId, user) {
  const post = await ForumPost.findById(postId);
  if (!post || post.status !== 'active') throw ApiError.notFound('Bài trả lời không tồn tại');
  if (!canManage(post, user)) throw ApiError.forbidden('Chỉ chủ bài hoặc nhân viên mới được xóa bài trả lời');
  await markPostHidden(post, user, 'forum.post.delete');
  return { deleted: true, postId: post._id };
}

async function hidePost(postId, actor) {
  const post = await ForumPost.findById(postId);
  if (!post) throw ApiError.notFound('Bài trả lời không tồn tại');
  await markPostHidden(post, actor, 'forum.post.hide');
  return post;
}

async function deletePostAsStaff(postId, actor) {
  const post = await ForumPost.findById(postId);
  if (!post) throw ApiError.notFound('Bài trả lời không tồn tại');
  await markPostHidden(post, actor, 'forum.post.delete');
  return { deleted: true, postId: post._id };
}

async function toggleLike(Model, id, userId, label) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const target = await Model.findById(id).select('author status likes likeCount');
    if (!target || target.status === 'hidden') throw ApiError.notFound(`${label} không tồn tại`);
    const liked = (target.likes || []).some((like) => String(like) === String(userId));
    const filter = { _id: id, likes: liked ? userId : { $ne: userId } };
    const update = liked
      ? { $pull: { likes: userId }, $inc: { likeCount: -1 } }
      : { $addToSet: { likes: userId }, $inc: { likeCount: 1 } };
    const result = await Model.findOneAndUpdate(filter, update, { new: true });
    if (result) return { liked: !liked, likeCount: result.likeCount };
  }
  throw ApiError.conflict('Không thể cập nhật lượt thích, vui lòng thử lại');
}

async function toggleThreadLike(threadId, userId) {
  return toggleLike(ForumThread, threadId, userId, 'Chủ đề');
}

async function togglePostLike(postId, userId) {
  return toggleLike(ForumPost, postId, userId, 'Bài trả lời');
}

module.exports = {
  cleanContent,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createReport,
  getAdminReports,
  updateReportStatus,
  setThreadPinned,
  setThreadLocked,
  hideThread,
  listThreads,
  listMyThreads,
  getMyThread,
  getThread,
  createThread,
  updateThread,
  deleteThread,
  listPosts,
  createPost,
  updatePost,
  deletePost,
  hidePost,
  deletePostAsStaff,
  toggleThreadLike,
  togglePostLike,
};
