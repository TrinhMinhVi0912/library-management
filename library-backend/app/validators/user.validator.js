const Joi = require('joi');

const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(50).messages({
    'string.empty': 'Họ lót không được để trống',
    'string.min': 'Họ lót phải có ít nhất 1 ký tự',
    'string.max': 'Họ lót không được vượt quá 50 ký tự',
  }),
  lastName: Joi.string().trim().min(1).max(50).messages({
    'string.empty': 'Tên không được để trống',
    'string.min': 'Tên phải có ít nhất 1 ký tự',
    'string.max': 'Tên không được vượt quá 50 ký tự',
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
})
  .min(1)
  .messages({
    'object.min': 'Vui lòng cung cấp ít nhất một thông tin cần cập nhật',
  });

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'string.empty': 'Mật khẩu hiện tại không được để trống',
    'any.required': 'Mật khẩu hiện tại là bắt buộc',
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
  updateProfileSchema,
  changePasswordSchema,
};

