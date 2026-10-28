const slugify = require('slugify');
const ApiError = require('../api-error');
const { Author, Category, Publisher, Book } = require('../models');
const { nextCode } = require('../utils/code.util');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');
const auditService = require('./audit.service');

/**
 * Sinh chuỗi slug tiếng Việt chuẩn SEO từ tiêu đề/tên
 * @param {string} text
 * @returns {string}
 */
const generateSlug = (text) => {
  return slugify(text, {
    lower: true,
    strict: true,
    locale: 'vi',
    trim: true,
  });
};

// =============================================================================
// AUTHORS (TÁC GIẢ)
// =============================================================================

/**
 * Lấy danh sách tác giả (có phân trang hoặc lấy tất cả)
 * @param {object} query
 */
async function getAuthors(query = {}) {
  const filter = {};
  if (query.q && query.q.trim()) {
    filter.name = { $regex: query.q.trim(), $options: 'i' };
  }

  if (query.all === true || query.all === 'true') {
    const authors = await Author.find(filter).sort(query.sort || 'name').lean();
    return {
      authors,
      meta: {
        total: authors.length,
        all: true,
      },
    };
  }

  const { page, limit, skip, sort } = parsePagination(query, { defaultSort: 'name' });
  const [authors, total] = await Promise.all([
    Author.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Author.countDocuments(filter),
  ]);

  return {
    authors,
    meta: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Lấy thông tin chi tiết một tác giả
 * @param {string} id
 */
async function getAuthorById(id) {
  const author = await Author.findById(id);
  if (!author) {
    throw ApiError.notFound('Không tìm thấy thông tin tác giả');
  }
  return author;
}

/**
 * Tạo mới tác giả
 * @param {object} data
 * @param {object} [context] { actor, ip }
 */
async function createAuthor(data, context = {}) {
  const author = await Author.create({
    name: data.name,
    bio: data.bio || '',
    photo: data.photo || null,
  });

  await auditService.log({
    actor: context.actor?._id || null,
    action: 'catalog.author.create',
    targetType: 'Author',
    targetId: author._id,
    detail: { name: author.name },
    ip: context.ip || null,
  });

  return author;
}

/**
 * Cập nhật tác giả
 * @param {string} id
 * @param {object} data
 * @param {object} [context]
 */
async function updateAuthor(id, data, context = {}) {
  const author = await Author.findById(id);
  if (!author) {
    throw ApiError.notFound('Không tìm thấy thông tin tác giả');
  }

  if (data.name !== undefined) author.name = data.name;
  if (data.bio !== undefined) author.bio = data.bio;
  if (data.photo !== undefined) author.photo = data.photo;

  await author.save();

  await auditService.log({
    actor: context.actor?._id || null,
    action: 'catalog.author.update',
    targetType: 'Author',
    targetId: author._id,
    detail: { updatedFields: Object.keys(data) },
    ip: context.ip || null,
  });

  return author;
}

/**
 * Xóa tác giả
 * @param {string} id
 * @param {object} [context]
 */
async function deleteAuthor(id, context = {}) {
  const author = await Author.findById(id);
  if (!author) {
    throw ApiError.notFound('Không tìm thấy thông tin tác giả');
  }

  // Chặn xóa nếu còn sách tham chiếu tác giả này
  const hasBooks = await Book.exists({ authors: id });
  if (hasBooks) {
    throw ApiError.conflict('Không thể xóa tác giả đang có sách thuộc về trong thư viện');
  }

  await author.deleteOne();

  await auditService.log({
    actor: context.actor?._id || null,
    action: 'catalog.author.delete',
    targetType: 'Author',
    targetId: id,
    detail: { name: author.name },
    ip: context.ip || null,
  });

  return { message: 'Đã xóa tác giả thành công' };
}

// =============================================================================
// CATEGORIES (THỂ LOẠI)
// =============================================================================

/**
 * Lấy danh sách thể loại (có phân trang hoặc toàn bộ)
 * @param {object} query
 */
async function getCategories(query = {}) {
  const filter = {};
  if (query.q && query.q.trim()) {
    filter.name = { $regex: query.q.trim(), $options: 'i' };
  }

  // Mặc định hoặc all: true -> trả toàn bộ thể loại (thường dùng cho menu, filter)
  if (query.all === true || query.all === 'true' || (!query.page && !query.limit)) {
    const categories = await Category.find(filter).sort(query.sort || 'name').lean();
    return {
      categories,
      meta: {
        total: categories.length,
        all: true,
      },
    };
  }

  const { page, limit, skip, sort } = parsePagination(query, { defaultSort: 'name' });
  const [categories, total] = await Promise.all([
    Category.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Category.countDocuments(filter),
  ]);

  return {
    categories,
    meta: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Lấy chi tiết một thể loại theo ID
 * @param {string} id
 */
async function getCategoryById(id) {
  const category = await Category.findById(id);
  if (!category) {
    throw ApiError.notFound('Không tìm thấy thông tin thể loại');
  }
  return category;
}

/**
 * Tạo mới thể loại (tự sinh slug từ name, chống trùng)
 * @param {object} data
 * @param {object} [context]
 */
async function createCategory(data, context = {}) {
  const slug = generateSlug(data.name);
  if (!slug) {
    throw ApiError.badRequest('Tên thể loại không hợp lệ để tạo định danh slug');
  }

  const existing = await Category.findOne({ slug });
  if (existing) {
    throw ApiError.conflict('Thể loại với tên này đã tồn tại trong hệ thống');
  }

  const category = await Category.create({
    name: data.name,
    slug,
    description: data.description || '',
  });

  await auditService.log({
    actor: context.actor?._id || null,
    action: 'catalog.category.create',
    targetType: 'Category',
    targetId: category._id,
    detail: { name: category.name, slug: category.slug },
    ip: context.ip || null,
  });

  return category;
}

/**
 * Cập nhật thể loại
 * @param {string} id
 * @param {object} data
 * @param {object} [context]
 */
async function updateCategory(id, data, context = {}) {
  const category = await Category.findById(id);
  if (!category) {
    throw ApiError.notFound('Không tìm thấy thông tin thể loại');
  }

  if (data.name && data.name !== category.name) {
    const newSlug = generateSlug(data.name);
    if (!newSlug) {
      throw ApiError.badRequest('Tên thể loại không hợp lệ để tạo định danh slug');
    }

    const duplicate = await Category.findOne({ slug: newSlug, _id: { $ne: id } });
    if (duplicate) {
      throw ApiError.conflict('Tên thể loại mới bị trùng với một thể loại đã tồn tại');
    }

    category.name = data.name;
    category.slug = newSlug;
  }

  if (data.description !== undefined) {
    category.description = data.description;
  }

  await category.save();

  await auditService.log({
    actor: context.actor?._id || null,
    action: 'catalog.category.update',
    targetType: 'Category',
    targetId: category._id,
    detail: { updatedFields: Object.keys(data), slug: category.slug },
    ip: context.ip || null,
  });

  return category;
}

/**
 * Xóa thể loại
 * @param {string} id
 * @param {object} [context]
 */
async function deleteCategory(id, context = {}) {
  const category = await Category.findById(id);
  if (!category) {
    throw ApiError.notFound('Không tìm thấy thông tin thể loại');
  }

  // Chặn xóa nếu còn sách thuộc thể loại này
  const hasBooks = await Book.exists({ categories: id });
  if (hasBooks) {
    throw ApiError.conflict('Không thể xóa thể loại đang có sách thuộc về trong thư viện');
  }

  await category.deleteOne();

  await auditService.log({
    actor: context.actor?._id || null,
    action: 'catalog.category.delete',
    targetType: 'Category',
    targetId: id,
    detail: { name: category.name, slug: category.slug },
    ip: context.ip || null,
  });

  return { message: 'Đã xóa thể loại thành công' };
}

// =============================================================================
// PUBLISHERS (NHÀ XUẤT BẢN)
// =============================================================================

/**
 * Lấy danh sách nhà xuất bản (có phân trang hoặc toàn bộ)
 * @param {object} query
 */
async function getPublishers(query = {}) {
  const filter = {};
  if (query.q && query.q.trim()) {
    const q = query.q.trim();
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { code: { $regex: q, $options: 'i' } },
    ];
  }

  if (query.all === true || query.all === 'true') {
    const publishers = await Publisher.find(filter).sort(query.sort || 'name').lean();
    return {
      publishers,
      meta: {
        total: publishers.length,
        all: true,
      },
    };
  }

  const { page, limit, skip, sort } = parsePagination(query, { defaultSort: 'name' });
  const [publishers, total] = await Promise.all([
    Publisher.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Publisher.countDocuments(filter),
  ]);

  return {
    publishers,
    meta: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Lấy chi tiết nhà xuất bản theo ID
 * @param {string} id
 */
async function getPublisherById(id) {
  const publisher = await Publisher.findById(id);
  if (!publisher) {
    throw ApiError.notFound('Không tìm thấy thông tin nhà xuất bản');
  }
  return publisher;
}

/**
 * Tạo mới nhà xuất bản (tự sinh mã NXB...)
 * @param {object} data
 * @param {object} [context]
 */
async function createPublisher(data, context = {}) {
  const code = await nextCode('publisher');

  const publisher = await Publisher.create({
    code,
    name: data.name,
    address: data.address || '',
  });

  await auditService.log({
    actor: context.actor?._id || null,
    action: 'catalog.publisher.create',
    targetType: 'Publisher',
    targetId: publisher._id,
    detail: { code: publisher.code, name: publisher.name },
    ip: context.ip || null,
  });

  return publisher;
}

/**
 * Cập nhật nhà xuất bản
 * @param {string} id
 * @param {object} data
 * @param {object} [context]
 */
async function updatePublisher(id, data, context = {}) {
  const publisher = await Publisher.findById(id);
  if (!publisher) {
    throw ApiError.notFound('Không tìm thấy thông tin nhà xuất bản');
  }

  if (data.name !== undefined) publisher.name = data.name;
  if (data.address !== undefined) publisher.address = data.address;

  await publisher.save();

  await auditService.log({
    actor: context.actor?._id || null,
    action: 'catalog.publisher.update',
    targetType: 'Publisher',
    targetId: publisher._id,
    detail: { updatedFields: Object.keys(data) },
    ip: context.ip || null,
  });

  return publisher;
}

/**
 * Xóa nhà xuất bản
 * @param {string} id
 * @param {object} [context]
 */
async function deletePublisher(id, context = {}) {
  const publisher = await Publisher.findById(id);
  if (!publisher) {
    throw ApiError.notFound('Không tìm thấy thông tin nhà xuất bản');
  }

  // Chặn xóa nếu còn sách tham chiếu NXB này
  const hasBooks = await Book.exists({ publisher: id });
  if (hasBooks) {
    throw ApiError.conflict('Không thể xóa nhà xuất bản đang có sách tham chiếu trong thư viện');
  }

  await publisher.deleteOne();

  await auditService.log({
    actor: context.actor?._id || null,
    action: 'catalog.publisher.delete',
    targetType: 'Publisher',
    targetId: id,
    detail: { code: publisher.code, name: publisher.name },
    ip: context.ip || null,
  });

  return { message: 'Đã xóa nhà xuất bản thành công' };
}

module.exports = {
  generateSlug,
  // Authors
  getAuthors,
  getAuthorById,
  createAuthor,
  updateAuthor,
  deleteAuthor,
  // Categories
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  // Publishers
  getPublishers,
  getPublisherById,
  createPublisher,
  updatePublisher,
  deletePublisher,
};

