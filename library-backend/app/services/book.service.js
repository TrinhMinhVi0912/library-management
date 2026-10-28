const mongoose = require('mongoose');
const slugify = require('slugify');
const ApiError = require('../api-error');
const {
  Book,
  Author,
  Category,
  Publisher,
  Loan,
  Cart,
  Shelf,
  Reservation,
  Review,
} = require('../models');
const codeUtil = require('../utils/code.util');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');
const cloudinaryUtil = require('../utils/cloudinary.util');
const auditService = require('./audit.service');

/**
 * Sinh chuỗi slug tiếng Việt chuẩn SEO từ tiêu đề sách
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

/**
 * Tạo slug duy nhất cho sách, tự động thêm hậu tố -1, -2 nếu trùng
 * @param {string} baseText
 * @param {string|null} [excludeId=null]
 * @returns {Promise<string>}
 */
const generateUniqueSlug = async (baseText, excludeId = null) => {
  let baseSlug = generateSlug(baseText);
  if (!baseSlug) {
    baseSlug = `book-${Date.now()}`;
  }

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = { slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const exists = await Book.exists(query);
    if (!exists) {
      return slug;
    }
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
};

/**
 * Xác thực tính hợp lệ của các ID tham chiếu (tác giả, thể loại, nhà xuất bản)
 * @param {object} param
 * @param {string[]} [param.authors]
 * @param {string[]} [param.categories]
 * @param {string} [param.publisher]
 */
const validateReferences = async ({ authors, categories, publisher }) => {
  if (authors && authors.length > 0) {
    const authorCount = await Author.countDocuments({ _id: { $in: authors } });
    if (authorCount !== authors.length) {
      throw ApiError.badRequest('Một hoặc nhiều tác giả được chọn không tồn tại trong hệ thống');
    }
  }

  if (categories && categories.length > 0) {
    const categoryCount = await Category.countDocuments({ _id: { $in: categories } });
    if (categoryCount !== categories.length) {
      throw ApiError.badRequest('Một hoặc nhiều thể loại được chọn không tồn tại trong hệ thống');
    }
  }

  if (publisher) {
    const publisherExists = await Publisher.exists({ _id: publisher });
    if (!publisherExists) {
      throw ApiError.badRequest('Nhà xuất bản được chọn không tồn tại trong hệ thống');
    }
  }
};

/**
 * Tạo mới một đầu sách (Dành cho Quản trị viên & Thủ thư)
 * @param {object} data
 * @param {object} [context]
 */
async function createBook(data, context = {}) {
  await validateReferences({
    authors: data.authors,
    categories: data.categories,
    publisher: data.publisher,
  });

  // Tự sinh mã sách qua counter (S000001, S000002, ...)
  const code = await codeUtil.nextCode('book');

  // Sinh slug duy nhất từ tiêu đề sách (nếu không truyền slug riêng)
  const slug = data.slug
    ? await generateUniqueSlug(data.slug)
    : await generateUniqueSlug(data.title);

  // Tự động tạo authorText nếu có danh sách authors mà chưa có text
  let authorText = data.authorText ? data.authorText.trim() : '';
  if (!authorText && Array.isArray(data.authors) && data.authors.length > 0) {
    const authorDocs = await Author.find({ _id: { $in: data.authors } }).select('name').lean();
    authorText = authorDocs.map((a) => a.name).join(', ');
  }

  const totalCopies = typeof data.totalCopies === 'number' ? data.totalCopies : 0;
  // Khi tạo sách mới: availableCopies = totalCopies
  const availableCopies = totalCopies;

  const book = await Book.create({
    ...data,
    code,
    slug,
    authorText,
    totalCopies,
    availableCopies,
  });

  await auditService.log({
    actor: context.actor?._id || null,
    action: 'book.create',
    targetType: 'Book',
    targetId: book._id,
    detail: {
      code: book.code,
      title: book.title,
      totalCopies: book.totalCopies,
    },
    ip: context.ip || null,
  });

  return Book.findById(book._id)
    .populate('authors', 'name photo')
    .populate('categories', 'name slug')
    .populate('publisher', 'code name');
}

/**
 * Lấy danh sách sách dành cho trang quản trị (hỗ trợ phân trang, tìm kiếm & lọc đầy đủ)
 * @param {object} query
 */
async function getAdminBooks(query = {}) {
  const filter = {};

  // Tìm kiếm theo từ khóa (tiêu đề, mã sách, tác giả, ISBN)
  if (query.q && query.q.trim()) {
    const q = query.q.trim();
    filter.$or = [
      { title: { $regex: q, $options: 'i' } },
      { code: { $regex: q, $options: 'i' } },
      { authorText: { $regex: q, $options: 'i' } },
      { isbn: { $regex: q, $options: 'i' } },
    ];
  }

  // Lọc theo thể loại
  if (query.category) {
    filter.categories = query.category;
  }

  // Lọc theo tác giả
  if (query.author) {
    filter.authors = query.author;
  }

  // Lọc theo nhà xuất bản
  if (query.publisher) {
    filter.publisher = query.publisher;
  }

  // Lọc theo trạng thái hiển thị
  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }

  const { page, limit, skip, sort } = parsePagination(query, { defaultSort: '-createdAt' });

  const [books, total] = await Promise.all([
    Book.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('authors', 'name photo')
      .populate('categories', 'name slug')
      .populate('publisher', 'code name')
      .lean(),
    Book.countDocuments(filter),
  ]);

  return {
    books,
    meta: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Lấy chi tiết sách theo ID dành cho quản trị
 * @param {string} id
 */
async function getBookById(id) {
  const book = await Book.findById(id)
    .populate('authors', 'name photo bio')
    .populate('categories', 'name slug description')
    .populate('publisher', 'code name address');

  if (!book) {
    throw ApiError.notFound('Không tìm thấy thông tin sách');
  }

  return book;
}

/**
 * Cập nhật thông tin sách
 * - Đảm bảo thay đổi totalCopies không vi phạm số lượng đang được mượn
 * - Xóa ảnh cũ trên Cloudinary nếu thay đổi ảnh bìa
 * - Ghi nhận audit log
 * 
 * @param {string} id
 * @param {object} data
 * @param {object} [context]
 */
async function updateBook(id, data, context = {}) {
  const book = await Book.findById(id);
  if (!book) {
    throw ApiError.notFound('Không tìm thấy thông tin sách');
  }

  await validateReferences({
    authors: data.authors,
    categories: data.categories,
    publisher: data.publisher,
  });

  // Xử lý slug nếu có yêu cầu đổi slug hoặc thay đổi tiêu đề
  if (data.slug && data.slug !== book.slug) {
    book.slug = await generateUniqueSlug(data.slug, book._id);
  } else if (data.title && data.title !== book.title && !data.slug) {
    book.slug = await generateUniqueSlug(data.title, book._id);
  }

  // Xử lý ràng buộc tồn kho khi đổi totalCopies:
  // Số sách đang được mượn (hoặc giữ) = totalCopies - availableCopies
  if (data.totalCopies !== undefined) {
    const newTotal = Number(data.totalCopies);
    const currentlyBorrowed = Math.max(0, book.totalCopies - book.availableCopies);

    if (newTotal < currentlyBorrowed) {
      throw ApiError.badRequest(
        `Không thể giảm tổng số lượng sách xuống ${newTotal} vì hiện đang có ${currentlyBorrowed} cuốn đang được mượn`
      );
    }

    // Cập nhật lại availableCopies tương ứng với chênh lệch
    book.availableCopies = newTotal - currentlyBorrowed;
    book.totalCopies = newTotal;
  }

  // Xử lý thay đổi hoặc xóa ảnh bìa trên Cloudinary
  if (data.cover !== undefined) {
    const oldPublicId = book.cover?.publicId;
    const newPublicId = data.cover?.publicId;

    if (oldPublicId && oldPublicId !== newPublicId) {
      await cloudinaryUtil.destroy(oldPublicId);
    }

    if (data.cover === null) {
      book.cover = { url: '', publicId: '' };
    } else {
      book.cover = data.cover;
    }
  }

  // Cập nhật tác giả & authorText
  if (data.authors !== undefined) {
    book.authors = data.authors;
    if (data.authorText !== undefined) {
      book.authorText = data.authorText ? data.authorText.trim() : '';
    } else if (Array.isArray(data.authors) && data.authors.length > 0) {
      const authorDocs = await Author.find({ _id: { $in: data.authors } }).select('name').lean();
      book.authorText = authorDocs.map((a) => a.name).join(', ');
    } else {
      book.authorText = '';
    }
  } else if (data.authorText !== undefined) {
    book.authorText = data.authorText ? data.authorText.trim() : '';
  }

  // Cập nhật các trường thông tin khác
  if (data.title !== undefined) book.title = data.title;
  if (data.isbn !== undefined) book.isbn = data.isbn ? data.isbn.trim() : '';
  if (data.publisher !== undefined) book.publisher = data.publisher || null;
  if (data.publishYear !== undefined) book.publishYear = data.publishYear;
  if (data.price !== undefined) book.price = data.price;
  if (data.categories !== undefined) book.categories = data.categories;
  if (data.language !== undefined) book.language = data.language;
  if (data.pages !== undefined) book.pages = data.pages;
  if (data.description !== undefined) book.description = data.description;
  if (data.location !== undefined) book.location = data.location;
  if (data.status !== undefined) book.status = data.status;

  await book.save();

  await auditService.log({
    actor: context.actor?._id || null,
    action: 'book.update',
    targetType: 'Book',
    targetId: book._id,
    detail: {
      title: book.title,
      code: book.code,
      updatedFields: Object.keys(data),
    },
    ip: context.ip || null,
  });

  return Book.findById(book._id)
    .populate('authors', 'name photo bio')
    .populate('categories', 'name slug')
    .populate('publisher', 'code name');
}

/**
 * Cập nhật trạng thái hiển thị (ẩn / hiện) của sách
 * @param {string} id
 * @param {'active'|'hidden'} status
 * @param {object} [context]
 */
async function updateBookStatus(id, status, context = {}) {
  const book = await Book.findById(id);
  if (!book) {
    throw ApiError.notFound('Không tìm thấy thông tin sách');
  }

  const oldStatus = book.status;
  book.status = status;
  await book.save();

  await auditService.log({
    actor: context.actor?._id || null,
    action: 'book.status.update',
    targetType: 'Book',
    targetId: book._id,
    detail: {
      oldStatus,
      newStatus: status,
      title: book.title,
      code: book.code,
    },
    ip: context.ip || null,
  });

  return book;
}

/**
 * Xóa một đầu sách
 * Chỉ cho phép xóa khi chưa có bất kỳ lịch sử mượn nào trong bảng loans (ném lỗi 409 nếu vi phạm).
 * Dọn ảnh bìa trên Cloudinary và làm sạch các liên kết giỏ hàng / kệ sách / đặt trước.
 * 
 * @param {string} id
 * @param {object} [context]
 */
async function deleteBook(id, context = {}) {
  const book = await Book.findById(id);
  if (!book) {
    throw ApiError.notFound('Không tìm thấy thông tin sách');
  }

  // 1. Kiểm tra lịch sử mượn
  const hasLoanHistory = await Loan.exists({ 'items.book': id });
  if (hasLoanHistory) {
    throw ApiError.conflict(
      'Không thể xóa sách đã có lịch sử mượn trong hệ thống. Bạn có thể chuyển trạng thái sách sang ẩn thay vì xóa.'
    );
  }

  // 2. Dọn ảnh bìa trên Cloudinary (nếu có)
  if (book.cover?.publicId) {
    await cloudinaryUtil.destroy(book.cover.publicId);
  }

  // 3. Dọn các tham chiếu phụ (giỏ hàng, kệ sách cá nhân, đặt trước, đánh giá)
  await Promise.all([
    Cart.updateMany({ 'items.book': id }, { $pull: { items: { book: id } } }),
    Shelf.updateMany({ 'items.book': id }, { $pull: { items: { book: id } } }),
    Reservation.deleteMany({ book: id }),
    Review.deleteMany({ book: id }),
    Book.findByIdAndDelete(id),
  ]);

  // 4. Ghi audit log
  await auditService.log({
    actor: context.actor?._id || null,
    action: 'book.delete',
    targetType: 'Book',
    targetId: id,
    detail: {
      code: book.code,
      title: book.title,
    },
    ip: context.ip || null,
  });

  return {
    id,
    code: book.code,
    title: book.title,
  };
}

/**
 * Lấy danh sách sách công khai (tìm kiếm, lọc, phân trang, sắp xếp)
 * @param {object} query
 * @returns {Promise<{ books: Array, meta: object }>}
 */
async function getPublicBooks(query = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 12, maxLimit: 100 });
  const filter = { status: 'active' };

  if (query.category) {
    filter.categories = query.category;
  }
  if (query.author) {
    filter.authors = query.author;
  }
  if (query.publisher) {
    filter.publisher = query.publisher;
  }
  if (query.year) {
    filter.publishYear = Number(query.year);
  }
  if (query.available === true || query.available === 'true' || query.available === '1' || query.available === 1) {
    filter.availableCopies = { $gt: 0 };
  }

  let projection = null;
  let sortOption;

  const hasSearch = Boolean(query.q && query.q.trim());
  if (hasSearch) {
    filter.$text = { $search: query.q.trim() };
  }

  switch (query.sort) {
  case 'relevance':
    if (hasSearch) {
      projection = { score: { $meta: 'textScore' } };
      sortOption = { score: { $meta: 'textScore' }, createdAt: -1 };
    } else {
      sortOption = { createdAt: -1 };
    }
    break;
  case 'new':
    sortOption = { createdAt: -1 };
    break;
  case 'popular':
    sortOption = { borrowCount: -1, createdAt: -1 };
    break;
  case 'az':
    sortOption = { title: 1 };
    break;
  default:
    if (hasSearch) {
      projection = { score: { $meta: 'textScore' } };
      sortOption = { score: { $meta: 'textScore' }, createdAt: -1 };
    } else {
      sortOption = { createdAt: -1 };
    }
    break;
  }

  const [totalItems, books] = await Promise.all([
    Book.countDocuments(filter),
    Book.find(filter, projection)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate('authors', 'name')
      .populate('publisher', 'name')
      .populate('categories', 'name slug')
      .lean(),
  ]);

  return {
    books,
    meta: buildPaginationMeta(totalItems, page, limit),
  };
}

/**
 * Gợi ý tìm kiếm sách công khai (tối đa 8 quyển)
 * @param {string} q
 * @returns {Promise<Array>}
 */
async function suggestBooks(q) {
  if (!q || typeof q !== 'string' || !q.trim()) {
    return [];
  }

  const keyword = q.trim();
  let books;

  try {
    books = await Book.find(
      { status: 'active', $text: { $search: keyword } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(8)
      .select('_id title slug cover authorText price availableCopies ratingAvg')
      .lean();
  } catch {
    books = [];
  }

  // Fallback regex nếu text search không trả về kết quả
  if (!books || books.length === 0) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    books = await Book.find({
      status: 'active',
      $or: [{ title: regex }, { authorText: regex }],
    })
      .limit(8)
      .select('_id title slug cover authorText price availableCopies ratingAvg')
      .lean();
  }

  return books;
}

/**
 * Lấy dữ liệu cho trang chủ (mới nhất, mượn nhiều nhất, đánh giá cao)
 * @returns {Promise<{ newest: Array, popular: Array, topRated: Array }>}
 */
async function getHomeBooks() {
  const [newest, popular, topRated] = await Promise.all([
    Book.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('authors', 'name')
      .populate('publisher', 'name')
      .populate('categories', 'name slug')
      .lean(),
    Book.find({ status: 'active' })
      .sort({ borrowCount: -1, createdAt: -1 })
      .limit(8)
      .populate('authors', 'name')
      .populate('publisher', 'name')
      .populate('categories', 'name slug')
      .lean(),
    Book.find({ status: 'active' })
      .sort({ ratingAvg: -1, ratingCount: -1, createdAt: -1 })
      .limit(8)
      .populate('authors', 'name')
      .populate('publisher', 'name')
      .populate('categories', 'name slug')
      .lean(),
  ]);

  return {
    newest,
    popular,
    topRated,
  };
}

/**
 * Lấy chi tiết sách công khai theo id hoặc slug (chỉ lấy sách active)
 * @param {string} idOrSlug
 * @returns {Promise<object>}
 */
async function getBookByIdOrSlug(idOrSlug) {
  const isObjectId = mongoose.Types.ObjectId.isValid(idOrSlug) && /^[0-9a-fA-F]{24}$/.test(idOrSlug);
  const query = {
    status: 'active',
    ...(isObjectId ? { $or: [{ _id: idOrSlug }, { slug: idOrSlug }] } : { slug: idOrSlug }),
  };

  const book = await Book.findOne(query)
    .populate('authors', 'name bio photo')
    .populate('publisher', 'code name address')
    .populate('categories', 'name slug description');

  if (!book) {
    throw ApiError.notFound('Không tìm thấy thông tin sách hoặc sách đã ngừng phát hành');
  }

  return book;
}

/**
 * Lấy danh sách sách liên quan (cùng thể loại hoặc cùng tác giả)
 * @param {string} bookId
 * @param {number} [limit=6]
 * @returns {Promise<Array>}
 */
async function getRelatedBooks(bookId, limit = 6) {
  const isObjectId = mongoose.Types.ObjectId.isValid(bookId) && /^[0-9a-fA-F]{24}$/.test(bookId);
  if (!isObjectId) {
    throw ApiError.badRequest('ID sách không hợp lệ');
  }

  const currentBook = await Book.findOne({ _id: bookId, status: 'active' });
  if (!currentBook) {
    throw ApiError.notFound('Không tìm thấy thông tin sách hoặc sách đã ngừng phát hành');
  }

  const conditions = [];
  if (currentBook.categories && currentBook.categories.length > 0) {
    conditions.push({ categories: { $in: currentBook.categories } });
  }
  if (currentBook.authors && currentBook.authors.length > 0) {
    conditions.push({ authors: { $in: currentBook.authors } });
  }

  const filter = {
    _id: { $ne: currentBook._id },
    status: 'active',
  };

  if (conditions.length > 0) {
    filter.$or = conditions;
  }

  const related = await Book.find(filter)
    .sort({ borrowCount: -1, createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 6, 1), 20))
    .populate('authors', 'name')
    .populate('publisher', 'name')
    .populate('categories', 'name slug')
    .lean();

  return related;
}

module.exports = {
  generateSlug,
  generateUniqueSlug,
  createBook,
  getAdminBooks,
  getBookById,
  updateBook,
  updateBookStatus,
  deleteBook,
  getPublicBooks,
  suggestBooks,
  getHomeBooks,
  getBookByIdOrSlug,
  getRelatedBooks,
};

