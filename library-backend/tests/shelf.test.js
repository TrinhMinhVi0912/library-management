const jwt = require('jsonwebtoken');
const supertest = require('supertest');
const app = require('../app');
const config = require('../app/config');
const { Book, Shelf, User } = require('../app/models');
const shelfService = require('../app/services/shelf.service');
const { shelfNameSchema } = require('../app/validators/shelf.validator');

const readerId = '507f1f77bcf86cd799439041';
const staffId = '507f1f77bcf86cd799439042';
const shelfId = '507f1f77bcf86cd799439043';
const bookId = '507f1f77bcf86cd799439044';

describe('BE-27: Reader shelves', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('Shelf validator', () => {
    it('trims and accepts a valid shelf name and rejects empty/long names', () => {
      expect(shelfNameSchema.validate({ name: '  Kệ mới  ' }).value.name).toBe('Kệ mới');
      expect(shelfNameSchema.validate({ name: '   ' }).error).toBeDefined();
      expect(shelfNameSchema.validate({ name: 'x'.repeat(101) }).error).toBeDefined();
    });
  });

  describe('Shelf service', () => {
    it('creates only missing default shelves and is safe to call repeatedly', async () => {
      const existingQuery = { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([{ name: 'Muốn đọc' }]) };
      const shelves = [{ name: 'Muốn đọc', type: 'want' }, { name: 'Đang đọc', type: 'reading' }, { name: 'Đã đọc', type: 'read' }];
      const resultQuery = { sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(shelves) };
      jest.spyOn(Shelf, 'find').mockImplementation((filter) => filter.name ? existingQuery : resultQuery);
      const bulkWrite = jest.spyOn(Shelf, 'bulkWrite').mockResolvedValue({ upsertedCount: 2 });

      await expect(shelfService.ensureDefaultShelves(readerId)).resolves.toEqual(shelves);

      expect(bulkWrite).toHaveBeenCalledWith([
        expect.objectContaining({ updateOne: expect.objectContaining({ filter: { user: readerId, name: 'Đang đọc' } }) }),
        expect.objectContaining({ updateOne: expect.objectContaining({ filter: { user: readerId, name: 'Đã đọc' } }) }),
      ], { ordered: false });
    });

    it('lists shelves, repairs missing defaults and populates their books', async () => {
      const populated = [{ _id: shelfId, name: 'Muốn đọc', items: [] }];
      const findCalls = [];
      const first = { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
      const second = { populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(populated) };
      jest.spyOn(Shelf, 'find').mockImplementation((filter) => {
        findCalls.push(filter);
        return findCalls.length === 1 ? first : second;
      });
      jest.spyOn(Shelf, 'bulkWrite').mockResolvedValue({ upsertedCount: 3 });

      const result = await shelfService.getMyShelves(readerId);

      expect(Shelf.bulkWrite).toHaveBeenCalledTimes(1);
      expect(second.populate).toHaveBeenCalledWith('items.book', 'code title slug cover authors ratingAvg ratingCount');
      expect(result).toEqual(populated);
    });

    it('creates custom shelves and maps duplicate names to 409', async () => {
      jest.spyOn(Shelf, 'create').mockResolvedValueOnce({ _id: shelfId, name: 'Kệ riêng', type: 'custom' })
        .mockRejectedValueOnce({ code: 11000 });

      await expect(shelfService.createShelf(readerId, ' Kệ riêng ')).resolves.toMatchObject({ type: 'custom', name: 'Kệ riêng' });
      await expect(shelfService.createShelf(readerId, 'Kệ riêng')).rejects.toMatchObject({ statusCode: 409 });
      await expect(shelfService.createShelf(readerId, 'Muốn đọc')).rejects.toMatchObject({ statusCode: 409 });
      await expect(shelfService.createShelf(readerId, 'Muốn đọc')).rejects.toMatchObject({ statusCode: 409 });
    });

    it('prevents renaming and deleting default shelves', async () => {
      jest.spyOn(Shelf, 'findOne').mockResolvedValue({ _id: shelfId, type: 'want', save: jest.fn() });
      jest.spyOn(Shelf, 'deleteOne');

      await expect(shelfService.updateShelf(readerId, shelfId, 'Tên khác')).rejects.toMatchObject({ statusCode: 409 });
      await expect(shelfService.deleteShelf(readerId, shelfId)).rejects.toMatchObject({ statusCode: 409 });
      expect(Shelf.deleteOne).not.toHaveBeenCalled();
    });

    it('updates and deletes custom shelves owned by the reader only', async () => {
      const shelf = { _id: shelfId, type: 'custom', name: 'Cũ', save: jest.fn().mockResolvedValue(true) };
      jest.spyOn(Shelf, 'findOne').mockResolvedValue(shelf);
      jest.spyOn(Shelf, 'deleteOne').mockResolvedValue({ deletedCount: 1 });

      await expect(shelfService.updateShelf(readerId, shelfId, 'Mới')).resolves.toBe(shelf);
      expect(shelf.name).toBe('Mới');
      await expect(shelfService.deleteShelf(readerId, shelfId)).resolves.toEqual({ deleted: true, shelfId });
      expect(Shelf.deleteOne).toHaveBeenCalledWith({ _id: shelfId, user: readerId });
    });

    it('rejects duplicate books and does not allow access to another reader shelf', async () => {
      jest.spyOn(Book, 'exists').mockResolvedValue({ _id: bookId });
      jest.spyOn(Shelf, 'findOneAndUpdate').mockResolvedValue(null);
      const shelfQuery = { select: jest.fn().mockResolvedValue({ _id: shelfId, items: [{ book: bookId }] }) };
      jest.spyOn(Shelf, 'findOne').mockReturnValue(shelfQuery);

      await expect(shelfService.addBook(readerId, shelfId, bookId)).rejects.toMatchObject({ statusCode: 409 });
      expect(Shelf.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: shelfId, user: readerId, 'items.book': { $ne: bookId } },
        { $push: { items: { book: bookId } } },
        { new: true, runValidators: true }
      );
    });

    it('adds a book atomically and returns not found for unknown book or shelf', async () => {
      jest.spyOn(Book, 'exists').mockResolvedValueOnce(null);
      await expect(shelfService.addBook(readerId, shelfId, bookId)).rejects.toMatchObject({ statusCode: 404 });
      Book.exists.mockResolvedValueOnce({ _id: bookId });
      jest.spyOn(Shelf, 'findOneAndUpdate').mockResolvedValueOnce({ _id: shelfId, items: [{ book: bookId }] });
      await expect(shelfService.addBook(readerId, shelfId, bookId)).resolves.toMatchObject({ _id: shelfId });
    });

    it('removes a book from an owned shelf and returns 404 for an unowned shelf', async () => {
      jest.spyOn(Shelf, 'findOneAndUpdate').mockResolvedValueOnce({ _id: shelfId, items: [] }).mockResolvedValueOnce(null);

      await expect(shelfService.removeBook(readerId, shelfId, bookId)).resolves.toMatchObject({ items: [] });
      expect(Shelf.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: shelfId, user: readerId }, { $pull: { items: { book: bookId } } }, { new: true }
      );
      await expect(shelfService.removeBook(readerId, shelfId, bookId)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('HTTP routes and reader access', () => {
    const readerToken = jwt.sign({ userId: readerId, role: 'reader', email: 'reader@test.com' }, config.jwt.accessSecret, { expiresIn: '15m' });
    const staffToken = jwt.sign({ userId: staffId, role: 'staff', email: 'staff@test.com' }, config.jwt.accessSecret, { expiresIn: '15m' });

    beforeEach(() => {
      jest.spyOn(User, 'findById').mockImplementation((id) => {
        if (id.toString() === readerId) return Promise.resolve({ _id: readerId, role: 'reader', status: 'active' });
        if (id.toString() === staffId) return Promise.resolve({ _id: staffId, role: 'staff', status: 'active' });
        return Promise.resolve(null);
      });
    });

    it('requires reader authentication for shelf endpoints', async () => {
      const unauthenticated = await supertest(app).get('/api/v1/me/shelves');
      const forbidden = await supertest(app).get('/api/v1/me/shelves').set('Authorization', `Bearer ${staffToken}`);

      expect(unauthenticated.statusCode).toBe(401);
      expect(forbidden.statusCode).toBe(403);
    });

    it('serves shelf list and validates create/update/add-book input', async () => {
      jest.spyOn(shelfService, 'getMyShelves').mockResolvedValue([{ _id: shelfId, name: 'Muốn đọc' }]);
      jest.spyOn(shelfService, 'createShelf').mockResolvedValue({ _id: shelfId, name: 'Kệ mới' });
      jest.spyOn(shelfService, 'updateShelf').mockResolvedValue({ _id: shelfId, name: 'Kệ sửa' });
      jest.spyOn(shelfService, 'addBook').mockResolvedValue({ _id: shelfId });

      const list = await supertest(app).get('/api/v1/me/shelves').set('Authorization', `Bearer ${readerToken}`);
      const badName = await supertest(app).post('/api/v1/me/shelves').set('Authorization', `Bearer ${readerToken}`).send({ name: '  ' });
      const created = await supertest(app).post('/api/v1/me/shelves').set('Authorization', `Bearer ${readerToken}`).send({ name: 'Kệ mới' });
      const updated = await supertest(app).patch(`/api/v1/me/shelves/${shelfId}`).set('Authorization', `Bearer ${readerToken}`).send({ name: 'Kệ sửa' });
      const added = await supertest(app).post(`/api/v1/me/shelves/${shelfId}/books/${bookId}`).set('Authorization', `Bearer ${readerToken}`);

      expect(list.statusCode).toBe(200);
      expect(badName.statusCode).toBe(422);
      expect(created.statusCode).toBe(201);
      expect(updated.statusCode).toBe(200);
      expect(added.statusCode).toBe(200);
    });

    it('routes delete shelf and remove book requests', async () => {
      jest.spyOn(shelfService, 'deleteShelf').mockResolvedValue({ deleted: true, shelfId });
      jest.spyOn(shelfService, 'removeBook').mockResolvedValue({ _id: shelfId, items: [] });

      const removedBook = await supertest(app).delete(`/api/v1/me/shelves/${shelfId}/books/${bookId}`).set('Authorization', `Bearer ${readerToken}`);
      const deletedShelf = await supertest(app).delete(`/api/v1/me/shelves/${shelfId}`).set('Authorization', `Bearer ${readerToken}`);

      expect(removedBook.statusCode).toBe(200);
      expect(deletedShelf.statusCode).toBe(200);
    });
  });
});
