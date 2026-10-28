const {
  parsePagination,
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} = require('../app/utils/pagination.util');

describe('Tiện ích phân trang (pagination.util)', () => {
  describe('parsePagination', () => {
    it('sử dụng giá trị mặc định khi query rỗng', () => {
      const result = parsePagination({});
      expect(result.page).toBe(DEFAULT_PAGE);
      expect(result.limit).toBe(DEFAULT_LIMIT);
      expect(result.skip).toBe(0);
      expect(result.sort).toBe('-createdAt');
    });

    it('tính toán đúng skip khi truyền page và limit hợp lệ', () => {
      const result = parsePagination({ page: '3', limit: '20' });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(20);
      expect(result.skip).toBe(40);
    });

    it('giới hạn limit tối đa về 100 khi client truyền > 100', () => {
      const result = parsePagination({ limit: '999' });
      expect(result.limit).toBe(MAX_LIMIT);
    });

    it('tự động xử lý khi page hoặc limit không hợp lệ (âm hoặc chữ)', () => {
      const result = parsePagination({ page: '-5', limit: 'abc' });
      expect(result.page).toBe(DEFAULT_PAGE);
      expect(result.limit).toBe(DEFAULT_LIMIT);
      expect(result.skip).toBe(0);
    });

    it('giữ nguyên cấu hình sort tùy chỉnh hoặc options tùy chỉnh', () => {
      const result = parsePagination(
        { sort: 'title:asc' },
        { defaultLimit: 24, defaultSort: 'createdAt' }
      );
      expect(result.limit).toBe(24);
      expect(result.sort).toBe('title:asc');
    });
  });

  describe('buildPaginationMeta', () => {
    it('tạo metadata phân trang chính xác khi truyền từng tham số', () => {
      const meta = buildPaginationMeta(45, 2, 12);
      expect(meta).toEqual({
        page: 2,
        limit: 12,
        total: 45,
        totalPages: 4,
      });
    });

    it('tạo metadata phân trang chính xác khi truyền object', () => {
      const meta = buildPaginationMeta({ total: 100, page: 5, limit: 20 });
      expect(meta).toEqual({
        page: 5,
        limit: 20,
        total: 100,
        totalPages: 5,
      });
    });

    it('xử lý đúng khi total = 0', () => {
      const meta = buildPaginationMeta(0, 1, 12);
      expect(meta.totalPages).toBe(0);
      expect(meta.total).toBe(0);
    });
  });
});
