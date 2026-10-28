const mongoose = require('mongoose');
const bookService = require('../app/services/book.service');
const bookController = require('../app/controllers/book.controller');
const { Book } = require('../app/models');
const {
  queryPublicBookSchema,
  suggestQuerySchema,
  idOrSlugParamSchema,
  relatedQuerySchema,
} = require('../app/validators/book.validator');

describe('BE-14: Sách công khai - Tìm kiếm, Lọc, Home, Chi tiết', () => {
  const createMockReqRes = (overrides = {}) => {
    const req = {
      ip: '127.0.0.1',
      headers: {},
      body: {},
      query: {},
      params: {},
      ...overrides,
    };
    const res = {
      statusCode: 200,
      jsonData: null,
      status: jest.fn().mockImplementation((code) => {
        res.statusCode = code;
        return res;
      }),
      json: jest.fn().mockImplementation((data) => {
        res.jsonData = data;
        return res;
      }),
    };
    const next = jest.fn();
    return { req, res, next };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Validators kiểm tra input công khai', () => {
    it('chấp nhận query hợp lệ với đầy đủ tham số', () => {
      const validQuery = {
        q: 'nguyen',
        category: '507f1f77bcf86cd799439011',
        author: '507f1f77bcf86cd799439012',
        publisher: '507f1f77bcf86cd799439013',
        year: '2024',
        available: 'true',
        sort: 'popular',
        page: '2',
        limit: '15',
      };
      const { error, value } = queryPublicBookSchema.validate(validQuery);
      expect(error).toBeUndefined();
      expect(value.available).toBe(true);
      expect(value.page).toBe(2);
      expect(value.limit).toBe(15);
      expect(value.year).toBe(2024);
    });

    it('từ chối sort không nằm trong danh mục cho phép', () => {
      const { error } = queryPublicBookSchema.validate({ sort: 'invalid_sort' });
      expect(error).toBeDefined();
    });

    it('chấp nhận idOrSlug là ObjectId hoặc slug chuỗi', () => {
      const validObjectId = { idOrSlug: '507f1f77bcf86cd799439011' };
      const validSlug = { idOrSlug: 'lap-trinh-node-js-co-ban' };
      expect(idOrSlugParamSchema.validate(validObjectId).error).toBeUndefined();
      expect(idOrSlugParamSchema.validate(validSlug).error).toBeUndefined();
    });

    it('từ chối idOrSlug rỗng', () => {
      const { error } = idOrSlugParamSchema.validate({ idOrSlug: '   ' });
      expect(error).toBeDefined();
    });

    it('giới hạn query limit của related books', () => {
      const { error: err1 } = relatedQuerySchema.validate({ limit: 0 });
      const { error: err2 } = relatedQuerySchema.validate({ limit: 25 });
      const { error: err3, value } = relatedQuerySchema.validate({ limit: 10 });
      expect(err1).toBeDefined();
      expect(err2).toBeDefined();
      expect(err3).toBeUndefined();
      expect(value.limit).toBe(10);
    });

    it('chấp nhận suggest query với chuỗi tìm kiếm', () => {
      const { error, value } = suggestQuerySchema.validate({ q: '  lap trinh  ' });
      expect(error).toBeUndefined();
      expect(value.q).toBe('lap trinh');
    });
  });

  describe('2. Text Search & Index kiểm tra tiếng Việt không dấu', () => {
    it('model Book được định nghĩa text index với default_language là "none" để tìm không phân biệt dấu', () => {
      const indexes = Book.schema.indexes();
      const textIndexEntry = indexes.find(([fields]) => fields.title === 'text' && fields.authorText === 'text');
      expect(textIndexEntry).toBeDefined();
      const options = textIndexEntry[1];
      expect(options.default_language).toBe('none');
      expect(options.language_override).toBe('none');
    });

    it('getPublicBooks xây dựng filter $text chính xác khi tìm kiếm từ khóa "nguyen"', async () => {
      let capturedFilter = null;
      let capturedSort = null;
      let capturedProjection = null;

      jest.spyOn(Book, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(Book, 'find').mockImplementation((filter, projection) => {
        capturedFilter = filter;
        capturedProjection = projection;
        return {
          sort: jest.fn().mockImplementation((sortObj) => {
            capturedSort = sortObj;
            return {
              skip: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              populate: jest.fn().mockReturnThis(),
              lean: jest.fn().mockResolvedValue([
                {
                  _id: '507f1f77bcf86cd799439011',
                  title: 'Nguyễn Du và Truyện Kiều',
                  authorText: 'Nguyễn Du',
                  status: 'active',
                },
              ]),
            };
          }),
        };
      });

      const result = await bookService.getPublicBooks({ q: 'nguyen', sort: 'relevance' });

      expect(capturedFilter.status).toBe('active');
      expect(capturedFilter.$text).toEqual({ $search: 'nguyen' });
      expect(capturedProjection).toEqual({ score: { $meta: 'textScore' } });
      expect(capturedSort).toEqual({ score: { $meta: 'textScore' }, createdAt: -1 });
      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe('Nguyễn Du và Truyện Kiều');
      expect(result.meta.total).toBe(1);
    });
  });

  describe('3. getPublicBooks - Lọc kết hợp, ẩn sách hidden & Phân trang', () => {
    it('chỉ lấy sách có status: "active", sách "hidden" bị loại trừ hoàn toàn', async () => {
      let capturedFilter = null;
      jest.spyOn(Book, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(Book, 'find').mockImplementation((filter) => {
        capturedFilter = filter;
        return {
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          populate: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([]),
        };
      });

      await bookService.getPublicBooks({});

      expect(capturedFilter.status).toBe('active');
    });

    it('áp dụng đúng các bộ lọc: category, author, publisher, year, available', async () => {
      let capturedFilter = null;
      jest.spyOn(Book, 'countDocuments').mockResolvedValue(2);
      jest.spyOn(Book, 'find').mockImplementation((filter) => {
        capturedFilter = filter;
        return {
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          populate: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([]),
        };
      });

      await bookService.getPublicBooks({
        category: '507f1f77bcf86cd799439011',
        author: '507f1f77bcf86cd799439012',
        publisher: '507f1f77bcf86cd799439013',
        year: 2023,
        available: true,
      });

      expect(capturedFilter.categories).toBe('507f1f77bcf86cd799439011');
      expect(capturedFilter.authors).toBe('507f1f77bcf86cd799439012');
      expect(capturedFilter.publisher).toBe('507f1f77bcf86cd799439013');
      expect(capturedFilter.publishYear).toBe(2023);
      expect(capturedFilter.availableCopies).toEqual({ $gt: 0 });
    });

    it('trả về meta phân trang chính xác', async () => {
      jest.spyOn(Book, 'countDocuments').mockResolvedValue(45);
      jest.spyOn(Book, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(new Array(12).fill({ title: 'Book' })),
      });

      const result = await bookService.getPublicBooks({ page: 2, limit: 12 });

      expect(result.meta).toEqual({
        page: 2,
        limit: 12,
        total: 45,
        totalPages: 4,
      });
    });

    it('hỗ trợ các kiểu sắp xếp khác nhau: new, popular, az', async () => {
      let capturedSort = null;
      jest.spyOn(Book, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(Book, 'find').mockReturnValue({
        sort: jest.fn().mockImplementation((sortObj) => {
          capturedSort = sortObj;
          return {
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            populate: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
          };
        }),
      });

      await bookService.getPublicBooks({ sort: 'popular' });
      expect(capturedSort).toEqual({ borrowCount: -1, createdAt: -1 });

      await bookService.getPublicBooks({ sort: 'az' });
      expect(capturedSort).toEqual({ title: 1 });

      await bookService.getPublicBooks({ sort: 'new' });
      expect(capturedSort).toEqual({ createdAt: -1 });
    });
  });

  describe('4. suggestBooks - Gợi ý tìm kiếm', () => {
    it('trả về mảng rỗng nếu q rỗng hoặc null', async () => {
      const res1 = await bookService.suggestBooks('');
      const res2 = await bookService.suggestBooks('   ');
      const res3 = await bookService.suggestBooks(null);
      expect(res1).toEqual([]);
      expect(res2).toEqual([]);
      expect(res3).toEqual([]);
    });

    it('tìm kiếm theo $text và chỉ lấy tối đa 8 quyển active', async () => {
      const mockSuggestions = [
        { _id: '1', title: 'Nguyễn Trãi Toàn Tập', slug: 'nguyen-trai-toan-tap' },
      ];
      let capturedFilter = null;
      let capturedLimit = null;

      jest.spyOn(Book, 'find').mockImplementation((filter) => {
        capturedFilter = filter;
        return {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockImplementation((lim) => {
            capturedLimit = lim;
            return {
              select: jest.fn().mockReturnThis(),
              lean: jest.fn().mockResolvedValue(mockSuggestions),
            };
          }),
        };
      });

      const result = await bookService.suggestBooks('nguyen');

      expect(capturedFilter.status).toBe('active');
      expect(capturedFilter.$text).toEqual({ $search: 'nguyen' });
      expect(capturedLimit).toBe(8);
      expect(result).toHaveLength(1);
    });
  });

  describe('5. getHomeBooks - Dữ liệu trang chủ', () => {
    it('trả về 3 danh sách newest, popular, topRated đều có status: active', async () => {
      const capturedFilters = [];
      jest.spyOn(Book, 'find').mockImplementation((filter) => {
        capturedFilters.push(filter);
        return {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          populate: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([{ title: 'Sách mẫu' }]),
        };
      });

      const homeData = await bookService.getHomeBooks();

      expect(homeData).toHaveProperty('newest');
      expect(homeData).toHaveProperty('popular');
      expect(homeData).toHaveProperty('topRated');
      expect(capturedFilters.every((f) => f.status === 'active')).toBe(true);
    });
  });

  describe('6. getBookByIdOrSlug - Chi tiết sách công khai', () => {
    it('tìm kiếm theo slug thành công khi sách active', async () => {
      const mockBook = {
        _id: '507f1f77bcf86cd799439011',
        title: 'Lập trình Node.js',
        slug: 'lap-trinh-node-js',
        status: 'active',
      };
      let capturedQuery = null;

      jest.spyOn(Book, 'findOne').mockImplementation((query) => {
        capturedQuery = query;
        return {
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockBook),
            }),
          }),
        };
      });

      const book = await bookService.getBookByIdOrSlug('lap-trinh-node-js');
      expect(capturedQuery).toEqual({ slug: 'lap-trinh-node-js', status: 'active' });
      expect(book.slug).toBe('lap-trinh-node-js');
    });

    it('tìm kiếm theo ObjectId thành công khi sách active', async () => {
      const mockBook = {
        _id: '507f1f77bcf86cd799439011',
        title: 'Sách hay',
        status: 'active',
      };
      jest.spyOn(Book, 'findOne').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockBook),
          }),
        }),
      });

      const book = await bookService.getBookByIdOrSlug('507f1f77bcf86cd799439011');
      expect(book._id).toBe('507f1f77bcf86cd799439011');
    });

    it('ném lỗi 404 nếu sách không tồn tại hoặc ở trạng thái hidden', async () => {
      jest.spyOn(Book, 'findOne').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      await expect(bookService.getBookByIdOrSlug('sach-an-hoac-khong-ton-tai')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('7. getRelatedBooks - Sách liên quan', () => {
    const validBookId = '507f1f77bcf86cd799439011';
    const catId = '507f1f77bcf86cd799439020';
    const authorId = '507f1f77bcf86cd799439030';

    it('lấy sách cùng thể loại hoặc tác giả, loại trừ chính sách hiện tại', async () => {
      const currentBook = {
        _id: new mongoose.Types.ObjectId(validBookId),
        status: 'active',
        categories: [new mongoose.Types.ObjectId(catId)],
        authors: [new mongoose.Types.ObjectId(authorId)],
      };

      jest.spyOn(Book, 'findOne').mockResolvedValue(currentBook);

      let capturedFilter = null;
      jest.spyOn(Book, 'find').mockImplementation((filter) => {
        capturedFilter = filter;
        return {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          populate: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([{ title: 'Sách liên quan' }]),
        };
      });

      const related = await bookService.getRelatedBooks(validBookId, 6);

      expect(capturedFilter.status).toBe('active');
      expect(capturedFilter._id).toEqual({ $ne: currentBook._id });
      expect(capturedFilter.$or).toBeDefined();
      expect(related).toHaveLength(1);
    });

    it('báo lỗi 404 nếu sách gốc không tồn tại hoặc bị ẩn', async () => {
      jest.spyOn(Book, 'findOne').mockResolvedValue(null);
      await expect(bookService.getRelatedBooks(validBookId)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('báo lỗi 400 nếu id sách không hợp lệ', async () => {
      await expect(bookService.getRelatedBooks('invalid-id')).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('8. Book Public Controllers', () => {
    it('getPublicBooks controller gọi service và trả về 200 kèm meta', async () => {
      const { req, res, next } = createMockReqRes({
        query: { page: 1, limit: 12 },
      });
      jest.spyOn(bookService, 'getPublicBooks').mockResolvedValue({
        books: [{ title: 'Sách 1' }],
        meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
      });

      await bookController.getPublicBooks(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data).toHaveLength(1);
      expect(res.jsonData.meta.total).toBe(1);
    });

    it('suggestBooks controller trả về danh sách gợi ý', async () => {
      const { req, res, next } = createMockReqRes({ query: { q: 'nguyen' } });
      jest.spyOn(bookService, 'suggestBooks').mockResolvedValue([{ title: 'Nguyễn Du' }]);

      await bookController.suggestBooks(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.data).toHaveLength(1);
    });

    it('getHomeBooks controller trả về dữ liệu home', async () => {
      const { req, res, next } = createMockReqRes();
      jest.spyOn(bookService, 'getHomeBooks').mockResolvedValue({
        newest: [],
        popular: [],
        topRated: [],
      });

      await bookController.getHomeBooks(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.data).toHaveProperty('newest');
    });

    it('getBookByIdOrSlug controller trả về chi tiết sách', async () => {
      const { req, res, next } = createMockReqRes({ params: { idOrSlug: 'sach-hay' } });
      jest.spyOn(bookService, 'getBookByIdOrSlug').mockResolvedValue({ title: 'Sách hay' });

      await bookController.getBookByIdOrSlug(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.data.title).toBe('Sách hay');
    });

    it('getRelatedBooks controller trả về danh sách liên quan', async () => {
      const { req, res, next } = createMockReqRes({
        params: { id: '507f1f77bcf86cd799439011' },
        query: { limit: 4 },
      });
      jest.spyOn(bookService, 'getRelatedBooks').mockResolvedValue([{ title: 'Sách tương tự' }]);

      await bookController.getRelatedBooks(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.data).toHaveLength(1);
    });
  });
});
