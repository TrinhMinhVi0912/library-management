const Counter = require('../app/models/counter.model');
const { formatCode, nextCode, CODE_CONFIG } = require('../app/utils/code.util');

describe('Tiện ích sinh mã tự tăng (code.util)', () => {
  describe('formatCode', () => {
    it('định dạng đúng mã độc giả (DG000001)', () => {
      expect(formatCode('user', 1)).toBe('DG000001');
      expect(formatCode('user', 99)).toBe('DG000099');
    });

    it('định dạng đúng mã phiếu mượn (PM000001)', () => {
      expect(formatCode('loan', 1)).toBe('PM000001');
    });

    it('định dạng đúng mã sách (S000001)', () => {
      expect(formatCode('book', 1)).toBe('S000001');
    });

    it('định dạng đúng mã nhà xuất bản (NXB001)', () => {
      expect(formatCode('publisher', 1)).toBe('NXB001');
      expect(formatCode('publisher', 12)).toBe('NXB012');
    });

    it('ném ra lỗi khi truyền loại mã không hợp lệ', () => {
      expect(() => formatCode('invalid_type', 1)).toThrow('Loại mã không hợp lệ');
    });
  });

  describe('nextCode', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('gọi nextCode("user") 3 lần liên tiếp ra DG000001..DG000003', async () => {
      let currentSeq = 0;
      jest.spyOn(Counter, 'findOneAndUpdate').mockImplementation(async (query, update) => {
        expect(query).toEqual({ _id: 'user' });
        currentSeq += update.$inc.seq;
        return { _id: 'user', seq: currentSeq };
      });

      const code1 = await nextCode('user');
      const code2 = await nextCode('user');
      const code3 = await nextCode('user');

      expect(code1).toBe('DG000001');
      expect(code2).toBe('DG000002');
      expect(code3).toBe('DG000003');
    });

    it('truyền đúng session vào truy vấn khi có session', async () => {
      const mockSession = { id: 'mock-session-id', startTransaction: jest.fn() };
      const spy = jest.spyOn(Counter, 'findOneAndUpdate').mockResolvedValue({ _id: 'loan', seq: 5 });

      const code = await nextCode('loan', { session: mockSession });
      expect(code).toBe('PM000005');
      expect(spy).toHaveBeenCalledWith(
        { _id: 'loan' },
        { $inc: { seq: 1 } },
        expect.objectContaining({ session: mockSession, upsert: true })
      );
    });

    it('hỗ trợ truyền trực tiếp ClientSession làm tham số options', async () => {
      const mockSession = { id: 'mock-session-id', startTransaction: jest.fn() };
      const spy = jest.spyOn(Counter, 'findOneAndUpdate').mockResolvedValue({ _id: 'book', seq: 10 });

      const code = await nextCode('book', mockSession);
      expect(code).toBe('S000010');
      expect(spy).toHaveBeenCalledWith(
        { _id: 'book' },
        { $inc: { seq: 1 } },
        expect.objectContaining({ session: mockSession })
      );
    });

    it('ném lỗi nếu gọi nextCode với loại mã không hỗ trợ', async () => {
      await expect(nextCode('unknown')).rejects.toThrow('Loại mã không hợp lệ');
    });
  });

  describe('CODE_CONFIG', () => {
    it('chứa đầy đủ 4 loại mã nghiệp vụ cốt lõi', () => {
      expect(CODE_CONFIG).toHaveProperty('user');
      expect(CODE_CONFIG).toHaveProperty('loan');
      expect(CODE_CONFIG).toHaveProperty('book');
      expect(CODE_CONFIG).toHaveProperty('publisher');
    });
  });
});
