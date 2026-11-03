const Joi = require('joi');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const audiences = ['user', 'all', 'readers', 'staff'];
const types = ['loan', 'renewal', 'due', 'overdue', 'fine', 'reservation', 'forum', 'system'];

const notificationIdParamSchema = Joi.object({ id: Joi.string().pattern(objectIdRegex).required() });

const adminNotificationsQuerySchema = Joi.object({
  audience: Joi.string().valid(...audiences),
  type: Joi.string().valid(...types),
  q: Joi.string().trim().max(100).allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().trim(),
});

const notificationFields = {
  audience: Joi.string().valid(...audiences),
  recipient: Joi.string().pattern(objectIdRegex).allow(null),
  type: Joi.string().valid(...types),
  title: Joi.string().trim().min(1).max(150),
  content: Joi.string().trim().min(1).max(5000),
  link: Joi.string().trim().max(500).allow('', null),
  expiresAt: Joi.date().iso().allow(null),
};

const createAdminNotificationSchema = Joi.object({
  ...notificationFields,
  audience: Joi.string().valid(...audiences).required(),
  recipient: Joi.when('audience', {
    is: 'user', then: Joi.string().pattern(objectIdRegex).required(), otherwise: Joi.forbidden(),
  }),
  type: Joi.string().valid(...types).required(),
  title: Joi.string().trim().min(1).max(150).required(),
  content: Joi.string().trim().min(1).max(5000).required(),
});

const updateAdminNotificationSchema = Joi.object(notificationFields).min(1);

module.exports = {
  notificationIdParamSchema,
  adminNotificationsQuerySchema,
  createAdminNotificationSchema,
  updateAdminNotificationSchema,
};
