const Joi = require('joi');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const userIdParamSchema = Joi.object({ id: Joi.string().pattern(objectIdRegex).required() });
const adminUsersQuerySchema = Joi.object({
  role: Joi.string().valid('reader', 'staff', 'admin'),
  status: Joi.string().valid('active', 'locked'),
  q: Joi.string().trim().max(100).allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().trim(),
});
const updateAdminUserSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(50),
  lastName: Joi.string().trim().min(1).max(50),
  birthDate: Joi.date().iso().allow(null, ''),
  gender: Joi.string().valid('male', 'female', 'other').allow(null, ''),
  address: Joi.string().trim().max(255).allow(null, ''),
  phone: Joi.string().trim().pattern(/^[0-9+() -]{8,20}$/).allow(null, ''),
  position: Joi.string().trim().max(100).allow(null, ''),
}).min(1);
const lockUserSchema = Joi.object({ reason: Joi.string().trim().min(1).max(500).required() });
const createStaffSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(50).required(),
  lastName: Joi.string().trim().min(1).max(50).required(),
  email: Joi.string().email().trim().lowercase().required(),
  password: Joi.string().min(8).max(100).pattern(/^(?=.*[A-Za-z])(?=.*\d)/).required(),
  position: Joi.string().trim().max(100).allow('', null),
  phone: Joi.string().trim().pattern(/^[0-9+() -]{8,20}$/).allow('', null),
  address: Joi.string().trim().max(255).allow('', null),
});
const updateRoleSchema = Joi.object({ role: Joi.string().valid('reader', 'staff', 'admin').required() });

module.exports = { userIdParamSchema, adminUsersQuerySchema, updateAdminUserSchema, lockUserSchema, createStaffSchema, updateRoleSchema };
