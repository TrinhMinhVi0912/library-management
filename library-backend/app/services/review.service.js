const mongoose = require('mongoose');
const ApiError = require('../api-error');
const { Book, Loan, Review } = require('../models');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');
const auditService = require('./audit.service');

async function canReview(userId, bookId) {
  return Boolean(await Loan.exists({
    reader: userId,
    items: { $elemMatch: { book: bookId, status: { $in: ['borrowing', 'returned', 'lost'] } } },
  }));
}

async function recalcRating(bookId) {
  const [stats] = await Review.aggregate([
    { $match: { book: new mongoose.Types.ObjectId(bookId), hidden: { $ne: true } } },
    { $group: { _id: '$book', ratingAvg: { $avg: '$rating' }, ratingCount: { $sum: 1 } } },
  ]);
  const book = await Book.findByIdAndUpdate(
    bookId,
    { $set: { ratingAvg: stats?.ratingAvg || 0, ratingCount: stats?.ratingCount || 0 } },
    { new: true }
  );
  if (!book) throw ApiError.notFound('Sách không tồn tại');
  return { ratingAvg: book.ratingAvg, ratingCount: book.ratingCount };
}

async function createOrUpdate(userId, bookId, data) {
  if (!(await canReview(userId, bookId))) {
    throw ApiError.forbidden('Bạn cần mượn sách này trước khi đánh giá');
  }
  if (!(await Book.exists({ _id: bookId }))) throw ApiError.notFound('Sách không tồn tại');
  const update = { $set: { rating: data.rating, comment: data.comment || '' }, $setOnInsert: { book: bookId, reader: userId, hidden: false } };
  let review;
  try {
    review = await Review.findOneAndUpdate({ book: bookId, reader: userId }, update, {
      new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    review = await Review.findOneAndUpdate({ book: bookId, reader: userId }, { $set: update.$set }, { new: true, runValidators: true });
  }
  await recalcRating(bookId);
  return review;
}

async function getBookReviews(bookId, query = {}) {
  if (!(await Book.exists({ _id: bookId }))) throw ApiError.notFound('Sách không tồn tại');
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = { book: bookId, hidden: { $ne: true } };
  const [items, total] = await Promise.all([
    Review.find(filter).populate('reader', 'firstName lastName avatar').sort(sort).skip(skip).limit(limit).lean(),
    Review.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(total, page, limit) };
}

async function getMyReviews(userId, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = { reader: userId };
  const [items, total] = await Promise.all([
    Review.find(filter).populate('book', 'code title slug cover').sort(sort).skip(skip).limit(limit).lean(),
    Review.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(total, page, limit) };
}

async function updateOwnReview(reviewId, userId, data) {
  const review = await Review.findOne({ _id: reviewId, reader: userId });
  if (!review) throw ApiError.notFound('Đánh giá không tồn tại hoặc không thuộc về bạn');
  if (data.rating !== undefined) review.rating = data.rating;
  if (data.comment !== undefined) review.comment = data.comment;
  await review.save();
  await recalcRating(review.book);
  return review;
}

async function deleteOwnReview(reviewId, userId) {
  const review = await Review.findOneAndDelete({ _id: reviewId, reader: userId });
  if (!review) throw ApiError.notFound('Đánh giá không tồn tại hoặc không thuộc về bạn');
  await recalcRating(review.book);
  return { deleted: true, reviewId: review._id };
}

async function setReviewHidden(reviewId, staffId, hidden, options = {}) {
  const review = await Review.findById(reviewId);
  if (!review) throw ApiError.notFound('Đánh giá không tồn tại');
  review.hidden = hidden;
  review.hiddenBy = hidden ? staffId : null;
  await review.save();
  await recalcRating(review.book);
  await auditService.log({
    actor: staffId, action: hidden ? 'review.hide' : 'review.unhide', targetType: 'Review', targetId: review._id,
    detail: { book: review.book, rating: review.rating }, ip: options.ip || null,
  });
  return review;
}

module.exports = { canReview, createOrUpdate, recalcRating, getBookReviews, getMyReviews, updateOwnReview, deleteOwnReview, setReviewHidden };
