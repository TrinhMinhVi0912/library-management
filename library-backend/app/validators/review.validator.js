const Joi = require('joi');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const reviewIdParamSchema = Joi.object({ id: Joi.string().pattern(objectIdRegex).required() });
const bookReviewParamsSchema = Joi.object({ id: Joi.string().pattern(objectIdRegex).required() });
const createReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(2000).allow('', null).default(''),
});
const updateReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5),
  comment: Joi.string().trim().max(2000).allow('', null),
}).min(1);
const reviewListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(12),
  sort: Joi.string().trim(),
});
const reviewVisibilitySchema = Joi.object({ hidden: Joi.boolean().strict().required() });

module.exports = {
  reviewIdParamSchema, bookReviewParamsSchema, createReviewSchema, updateReviewSchema,
  reviewListQuerySchema, reviewVisibilitySchema,
};
