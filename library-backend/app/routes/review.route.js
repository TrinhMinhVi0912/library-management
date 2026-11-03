const express = require('express');
const { auth, requireRole, validate } = require('../middlewares');
const reviewController = require('../controllers/review.controller');
const {
  reviewIdParamSchema, bookReviewParamsSchema, createReviewSchema, updateReviewSchema,
  reviewListQuerySchema, reviewVisibilitySchema,
} = require('../validators/review.validator');

const router = express.Router();

router.get('/books/:id/reviews/can-review', auth, requireRole('reader'), validate(bookReviewParamsSchema, 'params'), reviewController.canReview);
router.get('/books/:id/reviews', validate(bookReviewParamsSchema, 'params'), validate(reviewListQuerySchema, 'query'), reviewController.getBookReviews);
router.post('/books/:id/reviews', auth, requireRole('reader'), validate({ params: bookReviewParamsSchema, body: createReviewSchema }), reviewController.createOrUpdate);

router.get('/me/reviews', auth, requireRole('reader'), validate(reviewListQuerySchema, 'query'), reviewController.getMyReviews);
router.patch('/reviews/:id', auth, requireRole('reader'), validate({ params: reviewIdParamSchema, body: updateReviewSchema }), reviewController.updateOwnReview);
router.delete('/reviews/:id', auth, requireRole('reader'), validate(reviewIdParamSchema, 'params'), reviewController.deleteOwnReview);

router.patch(
  '/admin/reviews/:id/visibility',
  auth,
  requireRole('staff', 'admin'),
  validate({ params: reviewIdParamSchema, body: reviewVisibilitySchema }),
  reviewController.setReviewVisibility
);

module.exports = router;
