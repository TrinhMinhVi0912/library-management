const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const supertest = require('supertest');
const app = require('../app');
const config = require('../app/config');
const { Book, Loan, Review, User } = require('../app/models');
const reviewService = require('../app/services/review.service');
const auditService = require('../app/services/audit.service');
const {
  createReviewSchema,
  updateReviewSchema,
  reviewVisibilitySchema,
} = require('../app/validators/review.validator');

const bookId = '507f1f77bcf86cd799439031';
const reviewId = '507f1f77bcf86cd799439032';
const readerId = '507f1f77bcf86cd799439033';
const staffId = '507f1f77bcf86cd799439034';
const otherId = '507f1f77bcf86cd799439035';

describe('BE-26: Reviews', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('Validators', () => {
    it('accepts a rating from 1 to 5 and defaults comment', () => {
      expect(createReviewSchema.validate({ rating: 5 }).value).toMatchObject({ rating: 5, comment: '' });
      expect(createReviewSchema.validate({ rating: 0 }).error).toBeDefined();
      expect(createReviewSchema.validate({ rating: 6 }).error).toBeDefined();
    });

    it('requires at least one field when updating and validates visibility flag', () => {
      expect(updateReviewSchema.validate({}).error).toBeDefined();
      expect(updateReviewSchema.validate({ comment: 'Hay' }).error).toBeUndefined();
      expect(reviewVisibilitySchema.validate({ hidden: true }).error).toBeUndefined();
      expect(reviewVisibilitySchema.validate({ hidden: 'true' }).error).toBeDefined();
    });
  });

  describe('Review service', () => {
    it('checks eligibility against the same loan item and accepted statuses', async () => {
      jest.spyOn(Loan, 'exists').mockResolvedValue({ _id: 'loan-id' });

      await expect(reviewService.canReview(readerId, bookId)).resolves.toBe(true);
      expect(Loan.exists).toHaveBeenCalledWith({
        reader: readerId,
        items: { $elemMatch: { book: bookId, status: { $in: ['borrowing', 'returned', 'lost'] } } },
      });
    });

    it('forbids review creation when the reader never borrowed the book', async () => {
      jest.spyOn(Loan, 'exists').mockResolvedValue(null);
      const bookExists = jest.spyOn(Book, 'exists');
      const reviewUpsert = jest.spyOn(Review, 'findOneAndUpdate');

      await expect(reviewService.createOrUpdate(readerId, bookId, { rating: 4 })).rejects.toMatchObject({ statusCode: 403 });
      expect(bookExists).not.toHaveBeenCalled();
      expect(reviewUpsert).not.toHaveBeenCalled();
    });

    it('upserts one review for a reader and recalculates visible rating', async () => {
      const review = { _id: reviewId, book: bookId, reader: readerId, rating: 4, comment: 'Ổn' };
      jest.spyOn(Loan, 'exists').mockResolvedValue({ _id: 'loan-id' });
      jest.spyOn(Book, 'exists').mockResolvedValue({ _id: bookId });
      jest.spyOn(Review, 'findOneAndUpdate').mockResolvedValue(review);
      jest.spyOn(Review, 'aggregate').mockResolvedValue([{ ratingAvg: 4, ratingCount: 1 }]);
      jest.spyOn(Book, 'findByIdAndUpdate').mockResolvedValue({ ratingAvg: 4, ratingCount: 1 });

      const result = await reviewService.createOrUpdate(readerId, bookId, { rating: 4, comment: 'Ổn' });

      expect(Review.findOneAndUpdate).toHaveBeenCalledWith(
        { book: bookId, reader: readerId },
        expect.objectContaining({ $set: { rating: 4, comment: 'Ổn' } }),
        expect.objectContaining({ upsert: true, runValidators: true, new: true })
      );
      expect(Book.findByIdAndUpdate).toHaveBeenCalledWith(bookId, { $set: { ratingAvg: 4, ratingCount: 1 } }, { new: true });
      expect(result).toBe(review);
    });

    it('strips HTML and executable attributes from review comments before saving', async () => {
      jest.spyOn(Loan, 'exists').mockResolvedValue({ _id: 'loan-id' });
      jest.spyOn(Book, 'exists').mockResolvedValue({ _id: bookId });
      jest.spyOn(Review, 'findOneAndUpdate').mockResolvedValue({ _id: reviewId });
      jest.spyOn(Review, 'aggregate').mockResolvedValue([{ ratingAvg: 4, ratingCount: 1 }]);
      jest.spyOn(Book, 'findByIdAndUpdate').mockResolvedValue({ ratingAvg: 4, ratingCount: 1 });

      await reviewService.createOrUpdate(readerId, bookId, {
        rating: 4,
        comment: '<img src=x onerror="alert(1)">Ổn<script>alert(1)</script>',
      });

      expect(Review.findOneAndUpdate).toHaveBeenCalledWith(
        { book: bookId, reader: readerId },
        expect.objectContaining({ $set: { rating: 4, comment: 'Ổn' } }),
        expect.objectContaining({ upsert: true, runValidators: true, new: true })
      );
    });

    it('uses visible reviews only and resets rating to zero when no visible reviews remain', async () => {
      jest.spyOn(Review, 'aggregate').mockResolvedValue([]);
      jest.spyOn(Book, 'findByIdAndUpdate').mockResolvedValue({ ratingAvg: 0, ratingCount: 0 });

      await expect(reviewService.recalcRating(bookId)).resolves.toEqual({ ratingAvg: 0, ratingCount: 0 });
      expect(Review.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
        { $match: { book: new mongoose.Types.ObjectId(bookId), hidden: { $ne: true } } },
      ]));
      expect(Book.findByIdAndUpdate).toHaveBeenCalledWith(bookId, { $set: { ratingAvg: 0, ratingCount: 0 } }, { new: true });
    });

    it('returns public book reviews without hidden entries and paginates', async () => {
      const rows = [{ _id: reviewId, rating: 5 }];
      const query = {
        populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(rows),
      };
      jest.spyOn(Book, 'exists').mockResolvedValue({ _id: bookId });
      jest.spyOn(Review, 'find').mockReturnValue(query);
      jest.spyOn(Review, 'countDocuments').mockResolvedValue(1);

      const result = await reviewService.getBookReviews(bookId, { page: 2, limit: 5 });

      expect(Review.find).toHaveBeenCalledWith({ book: bookId, hidden: { $ne: true } });
      expect(query.skip).toHaveBeenCalledWith(5);
      expect(result.items).toBe(rows);
      expect(result.meta).toMatchObject({ page: 2, limit: 5, total: 1 });
    });

    it('returns the current reader review list with populated books', async () => {
      const rows = [{ _id: reviewId, book: { title: 'Sách mẫu' } }];
      const query = {
        populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(rows),
      };
      jest.spyOn(Review, 'find').mockReturnValue(query);
      jest.spyOn(Review, 'countDocuments').mockResolvedValue(1);

      const result = await reviewService.getMyReviews(readerId);

      expect(Review.find).toHaveBeenCalledWith({ reader: readerId });
      expect(query.populate).toHaveBeenCalledWith('book', 'code title slug cover');
      expect(result.items).toEqual(rows);
      expect(result.meta.total).toBe(1);
    });

    it('updates only fields of the owner review and recalculates rating', async () => {
      const review = { _id: reviewId, book: bookId, reader: readerId, rating: 3, comment: 'Cũ', save: jest.fn().mockResolvedValue(true) };
      jest.spyOn(Review, 'findOne').mockResolvedValue(review);
      jest.spyOn(Review, 'aggregate').mockResolvedValue([{ ratingAvg: 4, ratingCount: 2 }]);
      jest.spyOn(Book, 'findByIdAndUpdate').mockResolvedValue({ ratingAvg: 4, ratingCount: 2 });

      await reviewService.updateOwnReview(reviewId, readerId, { rating: 5 });

      expect(Review.findOne).toHaveBeenCalledWith({ _id: reviewId, reader: readerId });
      expect(review.rating).toBe(5);
      expect(review.comment).toBe('Cũ');
      expect(review.save).toHaveBeenCalled();
      expect(Review.aggregate).toHaveBeenCalled();
    });

    it('does not update or delete another reader review', async () => {
      jest.spyOn(Review, 'findOne').mockResolvedValue(null);
      jest.spyOn(Review, 'findOneAndDelete').mockResolvedValue(null);
      const aggregate = jest.spyOn(Review, 'aggregate');

      await expect(reviewService.updateOwnReview(reviewId, otherId, { rating: 1 })).rejects.toMatchObject({ statusCode: 404 });
      await expect(reviewService.deleteOwnReview(reviewId, otherId)).rejects.toMatchObject({ statusCode: 404 });
      expect(aggregate).not.toHaveBeenCalled();
    });

    it('deletes an owned review and recalculates its book rating', async () => {
      jest.spyOn(Review, 'findOneAndDelete').mockResolvedValue({ _id: reviewId, book: bookId });
      jest.spyOn(Review, 'aggregate').mockResolvedValue([{ ratingAvg: 2, ratingCount: 2 }]);
      jest.spyOn(Book, 'findByIdAndUpdate').mockResolvedValue({ ratingAvg: 2, ratingCount: 2 });

      await expect(reviewService.deleteOwnReview(reviewId, readerId)).resolves.toEqual({ deleted: true, reviewId });
      expect(Review.findOneAndDelete).toHaveBeenCalledWith({ _id: reviewId, reader: readerId });
      expect(Book.findByIdAndUpdate).toHaveBeenCalled();
    });

    it('hides and restores reviews, recalculating rating and writing audit', async () => {
      const review = { _id: reviewId, book: bookId, rating: 2, save: jest.fn().mockResolvedValue(true) };
      jest.spyOn(Review, 'findById').mockResolvedValue(review);
      jest.spyOn(Review, 'aggregate').mockResolvedValue([]);
      jest.spyOn(Book, 'findByIdAndUpdate').mockResolvedValue({ ratingAvg: 0, ratingCount: 0 });
      jest.spyOn(auditService, 'log').mockResolvedValue({});

      await reviewService.setReviewHidden(reviewId, staffId, true);
      expect(review.hidden).toBe(true);
      expect(review.hiddenBy).toBe(staffId);
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'review.hide' }));

      await reviewService.setReviewHidden(reviewId, staffId, false);
      expect(review.hidden).toBe(false);
      expect(review.hiddenBy).toBeNull();
      expect(auditService.log).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'review.unhide' }));
      expect(Review.aggregate).toHaveBeenCalledTimes(2);
    });
  });

  describe('HTTP endpoints and permissions', () => {
    const tokenFor = (id, role) => jwt.sign({ userId: id, role, email: `${role}@example.test` }, config.jwt.accessSecret, { expiresIn: '15m' });
    const readerToken = tokenFor(readerId, 'reader');
    const staffToken = tokenFor(staffId, 'staff');
    const otherToken = tokenFor(otherId, 'reader');

    beforeEach(() => {
      jest.spyOn(User, 'findById').mockImplementation((id) => {
        const users = {
          [readerId]: { _id: readerId, role: 'reader', status: 'active' },
          [staffId]: { _id: staffId, role: 'staff', status: 'active' },
          [otherId]: { _id: otherId, role: 'reader', status: 'active' },
        };
        return Promise.resolve(users[id.toString()] || null);
      });
    });

    it('serves book reviews publicly and requires reader auth for can-review', async () => {
      jest.spyOn(reviewService, 'getBookReviews').mockResolvedValue({ items: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } });
      jest.spyOn(reviewService, 'canReview').mockResolvedValue(true);
      const publicResponse = await supertest(app).get(`/api/v1/books/${bookId}/reviews`);
      const unauthenticated = await supertest(app).get(`/api/v1/books/${bookId}/reviews/can-review`);
      const allowed = await supertest(app).get(`/api/v1/books/${bookId}/reviews/can-review`).set('Authorization', `Bearer ${readerToken}`);

      expect(publicResponse.statusCode).toBe(200);
      expect(unauthenticated.statusCode).toBe(401);
      expect(allowed.statusCode).toBe(200);
      expect(allowed.body.data.canReview).toBe(true);
    });

    it('requires an eligible reader to create a review and returns 403 when service denies', async () => {
      jest.spyOn(reviewService, 'createOrUpdate').mockRejectedValue(Object.assign(new Error('Chưa mượn sách'), { statusCode: 403 }));
      const response = await supertest(app).post(`/api/v1/books/${bookId}/reviews`)
        .set('Authorization', `Bearer ${readerToken}`).send({ rating: 4 });
      expect(response.statusCode).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('allows a reader to create a review after service confirms eligibility', async () => {
      jest.spyOn(reviewService, 'createOrUpdate').mockResolvedValue({ _id: reviewId, rating: 4 });
      const response = await supertest(app).post(`/api/v1/books/${bookId}/reviews`)
        .set('Authorization', `Bearer ${readerToken}`).send({ rating: 4, comment: 'Tốt' });
      expect(response.statusCode).toBe(201);
      expect(reviewService.createOrUpdate).toHaveBeenCalledWith(readerId, bookId, { rating: 4, comment: 'Tốt' });
    });

    it('prevents non-owner review edits and accepts owner edits', async () => {
      jest.spyOn(reviewService, 'updateOwnReview')
        .mockRejectedValueOnce(Object.assign(new Error('Không thuộc quyền'), { statusCode: 404 }))
        .mockResolvedValueOnce({ _id: reviewId, rating: 5 });
      const denied = await supertest(app).patch(`/api/v1/reviews/${reviewId}`).set('Authorization', `Bearer ${otherToken}`).send({ rating: 5 });
      const allowed = await supertest(app).patch(`/api/v1/reviews/${reviewId}`).set('Authorization', `Bearer ${readerToken}`).send({ rating: 5 });
      expect(denied.statusCode).toBe(404);
      expect(allowed.statusCode).toBe(200);
    });

    it('restricts hide/unhide to staff/admin and requires boolean visibility', async () => {
      const forbidden = await supertest(app).patch(`/api/v1/admin/reviews/${reviewId}/visibility`)
        .set('Authorization', `Bearer ${readerToken}`).send({ hidden: true });
      const invalid = await supertest(app).patch(`/api/v1/admin/reviews/${reviewId}/visibility`)
        .set('Authorization', `Bearer ${staffToken}`).send({ hidden: 'yes' });
      jest.spyOn(reviewService, 'setReviewHidden').mockResolvedValue({ _id: reviewId, hidden: true });
      const allowed = await supertest(app).patch(`/api/v1/admin/reviews/${reviewId}/visibility`)
        .set('Authorization', `Bearer ${staffToken}`).send({ hidden: true });

      expect(forbidden.statusCode).toBe(403);
      expect(invalid.statusCode).toBe(422);
      expect(allowed.statusCode).toBe(200);
      expect(reviewService.setReviewHidden).toHaveBeenCalledWith(reviewId, staffId, true, expect.any(Object));
    });
  });
});
