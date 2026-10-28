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

module.exports = {
  generateSlug,
  generateUniqueSlug,
  createBook,
  getAdminBooks,
  getBookById,
  updateBook,
  updateBookStatus,
  deleteBook,
};

