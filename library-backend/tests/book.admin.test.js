const bookService = require('../app/services/book.service');
const bookController = require('../app/controllers/book.controller');
const {
  Book,
  Author,
  Loan,
  Cart,
  Shelf,
  Reservation,
  Review,
  AuditLog,
} = require('../app/models');
const {
  createBookSchema,
  updateBookSchema,
  updateStatusSchema,
  queryAdminBookSchema,
} = require('../app/validators/book.validator');
const cloudinaryUtil = require('../app/utils/cloudinary.util');
const codeUtil = require('../app/utils/code.util');

describe('BE-13: Sách - CRUD Quản trị (Admin Books)', () => {
  const createMockReqRes = (overrides = {}) => {
    const req = {
      user: { _id: '507f1f77bcf86cd799439011', role: 'staff' },
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

  describe('1. Book Validators', () => {
    it('chấp nhận payload tạo sách hợp lệ', () => {
      const validPayload = {
        title: 'Lập trình Node.js thực chiến',
        price: 150000,
        totalCopies: 10,
        language: 'Tiếng Việt',
        pages: 350,
      };
      const { error, value } = createBookSchema.validate(validPayload);
      expect(error).toBeUndefined();
      expect(value.title).toBe('Lập trình Node.js thực chiến');
      expect(value.status).toBe('active');
    });

    it('từ chối khi thiếu title hoặc totalCopies âm', () => {
      const { error: noTitleErr } = createBookSchema.validate({ totalCopies: 5 });
      expect(noTitleErr).toBeDefined();

      const { error: negCopiesErr } = createBookSchema.validate({
        title: 'Sách A',
        totalCopies: -2,
      });
      expect(negCopiesErr).toBeDefined();
    });

    it('từ chối updateBookSchema nếu không có trường nào để cập nhật', () => {
      const { error } = updateBookSchema.validate({});
      expect(error).toBeDefined();
    });

    it('updateStatusSchema chỉ chấp nhận active hoặc hidden', () => {
      expect(updateStatusSchema.validate({ status: 'active' }).error).toBeUndefined();
      expect(updateStatusSchema.validate({ status: 'hidden' }).error).toBeUndefined();
      expect(updateStatusSchema.validate({ status: 'archived' }).error).toBeDefined();
    });

    it('queryAdminBookSchema hỗ trợ phân trang và lọc status', () => {
      const { error, value } = queryAdminBookSchema.validate({
        page: '2',
        limit: '20',
        status: 'hidden',
        q: 'Công nghệ',
      });
      expect(error).toBeUndefined();
      expect(value.page).toBe(2);
      expect(value.limit).toBe(20);
      expect(value.status).toBe('hidden');
      expect(value.q).toBe('Công nghệ');
    });
  });

  describe('2. Book Service - Tạo sách (createBook)', () => {
    it('tạo sách thành công: sinh mã S..., slug duy nhất, availableCopies = totalCopies', async () => {
      jest.spyOn(codeUtil, 'nextCode').mockResolvedValue('S000001');
      jest.spyOn(Book, 'exists').mockResolvedValue(false);

      const mockBook = {
        _id: '607f1f77bcf86cd799439001',
        code: 'S000001',
        title: 'Đắc Nhân Tâm',
        slug: 'dac-nhan-tam',
        totalCopies: 12,
        availableCopies: 12,
        status: 'active',
      };

      jest.spyOn(Book, 'create').mockResolvedValue(mockBook);
      jest.spyOn(AuditLog, 'create').mockResolvedValue({});
      jest.spyOn(Book, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockBook),
          }),
        }),
      });

      const book = await bookService.createBook(
        {
          title: 'Đắc Nhân Tâm',
          totalCopies: 12,
        },
        { actor: { _id: '507f1f77bcf86cd799439011' }, ip: '127.0.0.1' }
      );

      expect(book.code).toBe('S000001');
      expect(book.totalCopies).toBe(12);
      expect(book.availableCopies).toBe(12);
      expect(Book.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'S000001',
          slug: 'dac-nhan-tam',
          totalCopies: 12,
          availableCopies: 12,
        })
      );
    });

    it('tự động xử lý slug trùng lặp bằng cách thêm hậu tố số', async () => {
      jest.spyOn(codeUtil, 'nextCode').mockResolvedValue('S000002');
      jest
        .spyOn(Book, 'exists')
        .mockResolvedValueOnce(true) // 'lap-trinh' đã tồn tại
        .mockResolvedValueOnce(false); // 'lap-trinh-1' chưa tồn tại

      jest.spyOn(Book, 'create').mockImplementation((data) => Promise.resolve({ _id: '123', ...data }));
      jest.spyOn(AuditLog, 'create').mockResolvedValue({});
      jest.spyOn(Book, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue({ slug: 'lap-trinh-1' }),
          }),
        }),
      });

      await bookService.createBook({ title: 'Lập trình', totalCopies: 5 });
      expect(Book.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'lap-trinh-1',
        })
      );
    });

    it('tự động lấy tên tác giả điền vào authorText nếu chưa có', async () => {
      const authorId = '507f1f77bcf86cd799439099';
      jest.spyOn(codeUtil, 'nextCode').mockResolvedValue('S000003');
      jest.spyOn(Author, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(Author, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ name: 'Dale Carnegie' }]),
        }),
      });
      jest.spyOn(Book, 'exists').mockResolvedValue(false);
      jest.spyOn(Book, 'create').mockResolvedValue({ _id: '123' });
      jest.spyOn(AuditLog, 'create').mockResolvedValue({});
      jest.spyOn(Book, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue({}),
          }),
        }),
      });

      await bookService.createBook({
        title: 'Đắc Nhân Tâm',
        authors: [authorId],
      });

      expect(Book.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authorText: 'Dale Carnegie',
        })
      );
    });

    it('báo lỗi 400 nếu tác giả/thể loại/nhà xuất bản tham chiếu không tồn tại', async () => {
      jest.spyOn(Author, 'countDocuments').mockResolvedValue(0);

      await expect(
        bookService.createBook({
          title: 'Sách mới',
          authors: ['507f1f77bcf86cd799439099'],
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('tác giả'),
      });
    });
  });

  describe('3. Book Service - Sửa sách (updateBook) & Ràng buộc tồn kho', () => {
    it('chặn giảm totalCopies dưới số lượng đang được mượn (ném 400)', async () => {
      // Giả sử sách có totalCopies: 10, availableCopies: 4 -> đang mượn: 6 cuốn
      const mockBook = {
        _id: '607f1f77bcf86cd799439001',
        totalCopies: 10,
        availableCopies: 4,
        title: 'Sách thử nghiệm',
      };
      jest.spyOn(Book, 'findById').mockResolvedValue(mockBook);

      // Thử giảm totalCopies xuống 5 (nhỏ hơn 6 đang mượn)
      await expect(
        bookService.updateBook(mockBook._id, { totalCopies: 5 })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('đang có 6 cuốn đang được mượn'),
      });
    });

    it('cho phép đổi totalCopies hợp lệ và cập nhật lại availableCopies tương ứng', async () => {
      // totalCopies: 10, available: 4 -> đang mượn 6. Tăng totalCopies lên 15 -> available mới phải là 9
      const mockBook = {
        _id: '607f1f77bcf86cd799439001',
        totalCopies: 10,
        availableCopies: 4,
        title: 'Sách thử nghiệm',
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Book, 'findById')
        .mockResolvedValueOnce(mockBook)
        .mockReturnValueOnce({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockBook),
            }),
          }),
        });
      jest.spyOn(AuditLog, 'create').mockResolvedValue({});

      await bookService.updateBook(mockBook._id, { totalCopies: 15 });

      expect(mockBook.totalCopies).toBe(15);
      expect(mockBook.availableCopies).toBe(9); // 15 - 6
      expect(mockBook.save).toHaveBeenCalled();
    });

    it('gọi Cloudinary destroy khi thay đổi ảnh bìa', async () => {
      const mockBook = {
        _id: '607f1f77bcf86cd799439001',
        title: 'Sách thử nghiệm',
        totalCopies: 5,
        availableCopies: 5,
        cover: {
          url: 'https://cloudinary.com/old.jpg',
          publicId: 'library/books/old_cover_123',
        },
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Book, 'findById')
        .mockResolvedValueOnce(mockBook)
        .mockReturnValueOnce({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockBook),
            }),
          }),
        });
      jest.spyOn(cloudinaryUtil, 'destroy').mockResolvedValue({ result: 'ok' });
      jest.spyOn(AuditLog, 'create').mockResolvedValue({});

      await bookService.updateBook(mockBook._id, {
        cover: {
          url: 'https://cloudinary.com/new.jpg',
          publicId: 'library/books/new_cover_456',
        },
      });

      expect(cloudinaryUtil.destroy).toHaveBeenCalledWith('library/books/old_cover_123');
      expect(mockBook.cover.publicId).toBe('library/books/new_cover_456');
    });
  });

  describe('4. Book Service - Ẩn/Hiện (updateBookStatus)', () => {
    it('cập nhật trạng thái sách và ghi audit log', async () => {
      const mockBook = {
        _id: '607f1f77bcf86cd799439001',
        title: 'Sách mẫu',
        code: 'S000001',
        status: 'active',
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Book, 'findById').mockResolvedValue(mockBook);
      jest.spyOn(AuditLog, 'create').mockResolvedValue({});

      const result = await bookService.updateBookStatus(mockBook._id, 'hidden', {
        actor: { _id: '507f1f77bcf86cd799439011' },
      });

      expect(result.status).toBe('hidden');
      expect(mockBook.save).toHaveBeenCalled();
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'book.status.update',
          detail: expect.objectContaining({
            oldStatus: 'active',
            newStatus: 'hidden',
          }),
        })
      );
    });
  });

  describe('5. Book Service - Xóa sách (deleteBook)', () => {
    it('chặn xóa sách khi đã có lịch sử mượn trong Loan (409 Conflict)', async () => {
      const mockBook = {
        _id: '607f1f77bcf86cd799439001',
        title: 'Sách đã từng mượn',
      };
      jest.spyOn(Book, 'findById').mockResolvedValue(mockBook);
      jest.spyOn(Loan, 'exists').mockResolvedValue(true); // Đã có phiếu mượn

      await expect(bookService.deleteBook(mockBook._id)).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('đã có lịch sử mượn'),
      });
    });

    it('xóa sách thành công khi chưa từng được mượn: xóa ảnh Cloudinary và làm sạch liên kết', async () => {
      const mockBook = {
        _id: '607f1f77bcf86cd799439001',
        title: 'Sách mới chưa ai mượn',
        code: 'S000005',
        cover: {
          publicId: 'library/books/cover_to_delete',
        },
      };
      jest.spyOn(Book, 'findById').mockResolvedValue(mockBook);
      jest.spyOn(Loan, 'exists').mockResolvedValue(false); // Chưa có lịch sử mượn
      jest.spyOn(cloudinaryUtil, 'destroy').mockResolvedValue({ result: 'ok' });
      jest.spyOn(Cart, 'updateMany').mockResolvedValue({});
      jest.spyOn(Shelf, 'updateMany').mockResolvedValue({});
      jest.spyOn(Reservation, 'deleteMany').mockResolvedValue({});
      jest.spyOn(Review, 'deleteMany').mockResolvedValue({});
      jest.spyOn(Book, 'findByIdAndDelete').mockResolvedValue({});
      jest.spyOn(AuditLog, 'create').mockResolvedValue({});

      const res = await bookService.deleteBook(mockBook._id);

      expect(res.id).toBe(mockBook._id);
      expect(cloudinaryUtil.destroy).toHaveBeenCalledWith('library/books/cover_to_delete');
      expect(Book.findByIdAndDelete).toHaveBeenCalledWith(mockBook._id);
      expect(Cart.updateMany).toHaveBeenCalled();
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'book.delete',
          targetId: mockBook._id,
        })
      );
    });
  });

  describe('6. Book Controller (Admin)', () => {
    it('createBook trả về status 201 với dữ liệu sách', async () => {
      jest.spyOn(bookService, 'createBook').mockResolvedValue({
        _id: '123',
        title: 'Cuốn sách mới',
      });
      const { req, res, next } = createMockReqRes({
        body: { title: 'Cuốn sách mới' },
      });

      await bookController.createBook(req, res, next);

      expect(res.statusCode).toBe(201);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.title).toBe('Cuốn sách mới');
    });

    it('getAdminBooks trả về danh sách kèm meta phân trang', async () => {
      jest.spyOn(bookService, 'getAdminBooks').mockResolvedValue({
        books: [{ title: 'Sách A' }, { title: 'Sách B' }],
        meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
      });
      const { req, res, next } = createMockReqRes({
        query: { page: '1' },
      });

      await bookController.getAdminBooks(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data).toHaveLength(2);
      expect(res.jsonData.meta.total).toBe(2);
    });

    it('getAdminBookById trả về chi tiết sách', async () => {
      jest.spyOn(bookService, 'getBookById').mockResolvedValue({
        _id: '123',
        title: 'Sách chi tiết',
      });
      const { req, res, next } = createMockReqRes({
        params: { id: '123' },
      });

      await bookController.getAdminBookById(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data._id).toBe('123');
    });

    it('updateBook cập nhật sách và trả về dữ liệu mới', async () => {
      jest.spyOn(bookService, 'updateBook').mockResolvedValue({
        _id: '123',
        title: 'Sách cập nhật',
      });
      const { req, res, next } = createMockReqRes({
        params: { id: '123' },
        body: { title: 'Sách cập nhật' },
      });

      await bookController.updateBook(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.title).toBe('Sách cập nhật');
    });

    it('updateBookStatus cập nhật trạng thái ẩn/hiện', async () => {
      jest.spyOn(bookService, 'updateBookStatus').mockResolvedValue({
        _id: '123',
        status: 'hidden',
      });
      const { req, res, next } = createMockReqRes({
        params: { id: '123' },
        body: { status: 'hidden' },
      });

      await bookController.updateBookStatus(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.status).toBe('hidden');
    });

    it('deleteBook xóa sách và trả về thông báo thành công', async () => {
      jest.spyOn(bookService, 'deleteBook').mockResolvedValue({
        id: '123',
        code: 'S000001',
        title: 'Sách đã xóa',
      });
      const { req, res, next } = createMockReqRes({
        params: { id: '123' },
      });

      await bookController.deleteBook(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.id).toBe('123');
    });
  });
});

