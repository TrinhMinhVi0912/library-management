const Joi = require('joi');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const idParamSchema = Joi.object({
  id: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'ID không đúng định dạng ObjectId hợp lệ',
    'string.empty': 'ID không được để trống',
    'any.required': 'ID là bắt buộc',
  }),
});

// ==================== AUTHOR ====================
const createAuthorSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Tên tác giả không được để trống',
    'string.min': 'Tên tác giả phải có ít nhất 1 ký tự',
    'string.max': 'Tên tác giả không được vượt quá 100 ký tự',
    'any.required': 'Tên tác giả là bắt buộc',
  }),
  bio: Joi.string().trim().max(2000).allow('', null).messages({
    'string.max': 'Tiểu sử tác giả không được vượt quá 2000 ký tự',
  }),
  photo: Joi.object({
    url: Joi.string().trim().uri().allow('', null).messages({
      'string.uri': 'Đường dẫn ảnh đại diện tác giả không hợp lệ',
    }),
    publicId: Joi.string().trim().allow('', null),
  }).allow(null),
});

const updateAuthorSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).messages({
    'string.empty': 'Tên tác giả không được để trống',
    'string.min': 'Tên tác giả phải có ít nhất 1 ký tự',
    'string.max': 'Tên tác giả không được vượt quá 100 ký tự',
  }),
  bio: Joi.string().trim().max(2000).allow('', null).messages({
    'string.max': 'Tiểu sử tác giả không được vượt quá 2000 ký tự',
  }),
  photo: Joi.object({
    url: Joi.string().trim().uri().allow('', null).messages({
      'string.uri': 'Đường dẫn ảnh đại diện tác giả không hợp lệ',
    }),
    publicId: Joi.string().trim().allow('', null),
  }).allow(null),
})
  .min(1)
  .messages({
    'object.min': 'Vui lòng cung cấp ít nhất một trường cần cập nhật',
  });

const queryAuthorSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(12),
  sort: Joi.string().trim().allow(''),
  q: Joi.string().trim().allow(''),
  all: Joi.boolean().truthy('true', '1').falsy('false', '0'),
});

// ==================== CATEGORY ====================
const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Tên thể loại không được để trống',
    'string.min': 'Tên thể loại phải có ít nhất 1 ký tự',
    'string.max': 'Tên thể loại không được vượt quá 100 ký tự',
    'any.required': 'Tên thể loại là bắt buộc',
  }),
  description: Joi.string().trim().max(1000).allow('', null).messages({
    'string.max': 'Mô tả thể loại không được vượt quá 1000 ký tự',
  }),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).messages({
    'string.empty': 'Tên thể loại không được để trống',
    'string.min': 'Tên thể loại phải có ít nhất 1 ký tự',
    'string.max': 'Tên thể loại không được vượt quá 100 ký tự',
  }),
  description: Joi.string().trim().max(1000).allow('', null).messages({
    'string.max': 'Mô tả thể loại không được vượt quá 1000 ký tự',
  }),
})
  .min(1)
  .messages({
    'object.min': 'Vui lòng cung cấp ít nhất một trường cần cập nhật',
  });

const queryCategorySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(12),
  sort: Joi.string().trim().allow(''),
  q: Joi.string().trim().allow(''),
  all: Joi.boolean().truthy('true', '1').falsy('false', '0'),
});

// ==================== PUBLISHER ====================
const createPublisherSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required().messages({
    'string.empty': 'Tên nhà xuất bản không được để trống',
    'string.min': 'Tên nhà xuất bản phải có ít nhất 1 ký tự',
    'string.max': 'Tên nhà xuất bản không được vượt quá 150 ký tự',
    'any.required': 'Tên nhà xuất bản là bắt buộc',
  }),
  address: Joi.string().trim().max(255).allow('', null).messages({
    'string.max': 'Địa chỉ không được vượt quá 255 ký tự',
  }),
});

const updatePublisherSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).messages({
    'string.empty': 'Tên nhà xuất bản không được để trống',
    'string.min': 'Tên nhà xuất bản phải có ít nhất 1 ký tự',
    'string.max': 'Tên nhà xuất bản không được vượt quá 150 ký tự',
  }),
  address: Joi.string().trim().max(255).allow('', null).messages({
    'string.max': 'Địa chỉ không được vượt quá 255 ký tự',
  }),
})
  .min(1)
  .messages({
    'object.min': 'Vui lòng cung cấp ít nhất một trường cần cập nhật',
  });

const queryPublisherSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(12),
  sort: Joi.string().trim().allow(''),
  q: Joi.string().trim().allow(''),
  all: Joi.boolean().truthy('true', '1').falsy('false', '0'),
});

module.exports = {
  idParamSchema,
  createAuthorSchema,
  updateAuthorSchema,
  queryAuthorSchema,
  createCategorySchema,
  updateCategorySchema,
  queryCategorySchema,
  createPublisherSchema,
  updatePublisherSchema,
  queryPublisherSchema,
};

