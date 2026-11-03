const Joi = require('joi');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const idParamSchema = Joi.object({ id: Joi.string().pattern(objectIdRegex).required() });
const threadParamSchema = Joi.object({ idOrSlug: Joi.string().trim().min(1).max(180).required() });
const contentSchema = Joi.string().trim().min(1).max(10000).required();
const postContentSchema = Joi.string().trim().min(1).max(5000).required();

const categoryBodyFields = {
  name: Joi.string().trim().min(1).max(100),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]+$/).max(120).allow(''),
  description: Joi.string().trim().max(1000).allow('', null),
  order: Joi.number().integer().min(0),
};
const createCategorySchema = Joi.object({ ...categoryBodyFields, name: categoryBodyFields.name.required() });
const updateCategorySchema = Joi.object(categoryBodyFields).min(1);

const createThreadSchema = Joi.object({
  category: Joi.string().pattern(objectIdRegex).required(),
  title: Joi.string().trim().min(1).max(150).required(),
  content: contentSchema,
  book: Joi.string().pattern(objectIdRegex).allow(null, ''),
  tags: Joi.array().items(Joi.string().trim().min(1).max(40)).max(10).unique().default([]),
});
const updateThreadSchema = Joi.object({
  category: Joi.string().pattern(objectIdRegex),
  title: Joi.string().trim().min(1).max(150),
  content: contentSchema,
  book: Joi.string().pattern(objectIdRegex).allow(null, ''),
  tags: Joi.array().items(Joi.string().trim().min(1).max(40)).max(10).unique(),
  pinned: Joi.boolean().strict(),
  locked: Joi.boolean().strict(),
}).min(1);
const createPostSchema = Joi.object({
  content: postContentSchema,
  parent: Joi.string().pattern(objectIdRegex).allow(null),
});
const updatePostSchema = Joi.object({ content: postContentSchema }).min(1);
const forumListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(12),
  category: Joi.string().pattern(objectIdRegex),
  book: Joi.string().pattern(objectIdRegex),
  q: Joi.string().trim().max(100),
  sort: Joi.string().valid('latest', 'active', 'popular', 'views').default('active'),
});

module.exports = {
  idParamSchema,
  threadParamSchema,
  createCategorySchema,
  updateCategorySchema,
  createThreadSchema,
  updateThreadSchema,
  createPostSchema,
  updatePostSchema,
  forumListQuerySchema,
};
