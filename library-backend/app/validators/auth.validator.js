const Joi = require('joi');

const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(50).required().messages({
    'string.empty': 'Họ lót không được để trống',
    'string.min': 'Họ lót phải có ít nhất 1 ký tự',
    'string.max': 'Họ lót không được vượt quá 50 ký tự',
    'any.required': 'Họ lót là bắt buộc',
  }),
  lastName: Joi.string().trim().min(1).max(50).required().messages({
    'string.empty': 'Tên không được để trống',
    'string.min': 'Tên phải có ít nhất 1 ký tự',
    'string.max': 'Tên không được vượt quá 50 ký tự',
    'any.required': 'Tên là bắt buộc',
  }),
  email: Joi.string().email().trim().lowercase().required().messages({
    'string.email': 'Email không đúng định dạng',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là bắt buộc',
  }),
  password: Joi.string()
    .min(8)
    .max(100)
    .pattern(/^(?=.*[A-Za-z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Mật khẩu phải có ít nhất 8 ký tự',
      'string.max': 'Mật khẩu không được vượt quá 100 ký tự',
      'string.pattern.base': 'Mật khẩu phải chứa ít nhất một chữ cái và một chữ số',
      'string.empty': 'Mật khẩu không được để trống',
      'any.required': 'Mật khẩu là bắt buộc',
    }),
  birthDate: Joi.date().iso().allow(null, '').messages({
    'date.format': 'Ngày sinh không đúng định dạng ngày tháng hợp lệ',
  }),
  gender: Joi.string().valid('male', 'female', 'other').allow(null, '').messages({
    'any.only': 'Giới tính phải là male, female hoặc other',
  }),
  address: Joi.string().trim().max(255).allow(null, '').messages({
    'string.max': 'Địa chỉ không được vượt quá 255 ký tự',
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+() -]{8,20}$/)
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Số điện thoại không đúng định dạng',
    }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required().messages({
    'string.email': 'Email không đúng định dạng',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là bắt buộc',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Mật khẩu không được để trống',
    'any.required': 'Mật khẩu là bắt buộc',
  }),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().allow('', null).optional(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required().messages({
    'string.email': 'Email không đúng định dạng',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là bắt buộc',
  }),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().required().messages({
    'string.empty': 'Mã khôi phục token không được để trống',
    'any.required': 'Mã khôi phục token là bắt buộc',
  }),
  newPassword: Joi.string()
    .min(8)
    .max(100)
    .pattern(/^(?=.*[A-Za-z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Mật khẩu mới phải có ít nhất 8 ký tự',
      'string.max': 'Mật khẩu mới không được vượt quá 100 ký tự',
      'string.pattern.base': 'Mật khẩu mới phải chứa ít nhất một chữ cái và một chữ số',
      'string.empty': 'Mật khẩu mới không được để trống',
      'any.required': 'Mật khẩu mới là bắt buộc',
    }),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};

