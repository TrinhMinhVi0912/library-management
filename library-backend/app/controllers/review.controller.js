const { ok, asyncHandler } = require('../middlewares');
const reviewService = require('../services/review.service');

const getBookReviews = asyncHandler(async (req, res) => {
  const result = await reviewService.getBookReviews(req.params.id, req.query);
  return ok(res, result.items, result.meta);
});

const canReview = asyncHandler(async (req, res) => {
  const allowed = await reviewService.canReview(req.user._id, req.params.id);
  return ok(res, { canReview: allowed });
});

const createOrUpdate = asyncHandler(async (req, res) => {
  const review = await reviewService.createOrUpdate(req.user._id, req.params.id, req.body);
  return ok(res, review, null, 201);
});

const getMyReviews = asyncHandler(async (req, res) => {
  const result = await reviewService.getMyReviews(req.user._id, req.query);
  return ok(res, result.items, result.meta);
});

const updateOwnReview = asyncHandler(async (req, res) => {
  const review = await reviewService.updateOwnReview(req.params.id, req.user._id, req.body);
  return ok(res, review);
});

const deleteOwnReview = asyncHandler(async (req, res) => {
  const result = await reviewService.deleteOwnReview(req.params.id, req.user._id);
  return ok(res, result);
});

const setReviewVisibility = asyncHandler(async (req, res) => {
  const review = await reviewService.setReviewHidden(req.params.id, req.user._id, req.body.hidden, { ip: req.ip });
  return ok(res, review);
});

module.exports = { getBookReviews, canReview, createOrUpdate, getMyReviews, updateOwnReview, deleteOwnReview, setReviewVisibility };
