const Joi = require('joi');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const shelfIdParamsSchema = Joi.object({ id: Joi.string().pattern(objectIdRegex).required() });
const shelfBookParamsSchema = Joi.object({
  id: Joi.string().pattern(objectIdRegex).required(),
  bookId: Joi.string().pattern(objectIdRegex).required(),
});
const shelfNameSchema = Joi.object({ name: Joi.string().trim().min(1).max(100).required() });

module.exports = { shelfIdParamsSchema, shelfBookParamsSchema, shelfNameSchema };
