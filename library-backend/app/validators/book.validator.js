const Joi = require('joi');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const currentYear = new Date().getFullYear();

const idParamSchema = Joi.object({
  id: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'ID không đúng định dạng ObjectId hợp lệ',
    'string.empty': 'ID không được để trống',
    'any.required': 'ID là bắt buộc',
  }),
});

const createBookSchema = Joi.object({
  title: Joi.string().trim().min(1).max(255).required().messages({
    'string.empty': 'Tên sách không được để trống',
    'string.min': 'Tên sách phải có ít nhất 1 ký tự',
    'string.max': 'Tên sách không được vượt quá 255 ký tự',
    'any.required': 'Tên sách là bắt buộc',
  }),
  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .max(255)
    .allow('', null)
    .messages({
      'string.pattern.base': 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang (-)',
    }),
  isbn: Joi.string().trim().max(30).allow('', null).messages({
    'string.max': 'Mã ISBN không được vượt quá 30 ký tự',
  }),
  authors: Joi.array()
    .items(
      Joi.string().pattern(objectIdRegex).messages({
        'string.pattern.base': 'ID tác giả không hợp lệ',
      })
    )
    .default([]),
  authorText: Joi.string().trim().max(255).allow('', null).messages({
    'string.max': 'Tên tác giả hiển thị không được vượt quá 255 ký tự',
  }),
  publisher: Joi.string().pattern(objectIdRegex).allow(null, '').messages({
    'string.pattern.base': 'ID nhà xuất bản không hợp lệ',
  }),
  publishYear: Joi.number()
    .integer()
    .min(1000)
    .max(currentYear + 1)
    .allow(null)
    .messages({
      'number.base': 'Năm xuất bản phải là số nguyên',
      'number.min': 'Năm xuất bản không hợp lệ (tối thiểu năm 1000)',
      'number.max': `Năm xuất bản không được vượt quá ${currentYear + 1}`,
    }),
  price: Joi.number().min(0).default(0).messages({
    'number.base': 'Đơn giá sách phải là số',
    'number.min': 'Đơn giá sách không được âm',
  }),
  totalCopies: Joi.number().integer().min(0).default(0).messages({
    'number.base': 'Tổng số lượng sách phải là số nguyên',
    'number.min': 'Tổng số lượng sách không được âm',
  }),
  categories: Joi.array()
    .items(
      Joi.string().pattern(objectIdRegex).messages({
        'string.pattern.base': 'ID thể loại không hợp lệ',
      })
    )
    .default([]),
  language: Joi.string().trim().max(50).default('Tiếng Việt').allow('', null),
  pages: Joi.number().integer().min(1).allow(null).messages({
    'number.base': 'Số trang sách phải là số nguyên',
    'number.min': 'Số trang sách phải lớn hơn 0',
  }),
  description: Joi.string().trim().max(5000).allow('', null).messages({
    'string.max': 'Mô tả sách không được vượt quá 5000 ký tự',
  }),
  cover: Joi.object({
    url: Joi.string().trim().uri().allow('', null).messages({
      'string.uri': 'Đường dẫn ảnh bìa không hợp lệ',
    }),
    publicId: Joi.string().trim().allow('', null),
  }).allow(null),
  location: Joi.string().trim().max(100).allow('', null).messages({
    'string.max': 'Vị trí kệ sách không được vượt quá 100 ký tự',
  }),
  status: Joi.string().valid('active', 'hidden').default('active').messages({
    'any.only': 'Trạng thái sách chỉ có thể là "active" hoặc "hidden"',
  }),
});

const updateBookSchema = Joi.object({
  title: Joi.string().trim().min(1).max(255).messages({
    'string.empty': 'Tên sách không được để trống',
    'string.min': 'Tên sách phải có ít nhất 1 ký tự',
    'string.max': 'Tên sách không được vượt quá 255 ký tự',
  }),
  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .max(255)
    .allow('', null)
    .messages({
      'string.pattern.base': 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang (-)',
    }),
  isbn: Joi.string().trim().max(30).allow('', null).messages({
    'string.max': 'Mã ISBN không được vượt quá 30 ký tự',
  }),
  authors: Joi.array().items(
    Joi.string().pattern(objectIdRegex).messages({
      'string.pattern.base': 'ID tác giả không hợp lệ',
    })
  ),
  authorText: Joi.string().trim().max(255).allow('', null).messages({
    'string.max': 'Tên tác giả hiển thị không được vượt quá 255 ký tự',
  }),
  publisher: Joi.string().pattern(objectIdRegex).allow(null, '').messages({
    'string.pattern.base': 'ID nhà xuất bản không hợp lệ',
  }),
  publishYear: Joi.number()
    .integer()
    .min(1000)
    .max(currentYear + 1)
    .allow(null)
    .messages({
      'number.base': 'Năm xuất bản phải là số nguyên',
      'number.min': 'Năm xuất bản không hợp lệ (tối thiểu năm 1000)',
      'number.max': `Năm xuất bản không được vượt quá ${currentYear + 1}`,
    }),
  price: Joi.number().min(0).messages({
    'number.base': 'Đơn giá sách phải là số',
    'number.min': 'Đơn giá sách không được âm',
  }),
  totalCopies: Joi.number().integer().min(0).messages({
    'number.base': 'Tổng số lượng sách phải là số nguyên',
    'number.min': 'Tổng số lượng sách không được âm',
  }),
  categories: Joi.array().items(
    Joi.string().pattern(objectIdRegex).messages({
      'string.pattern.base': 'ID thể loại không hợp lệ',
    })
  ),
  language: Joi.string().trim().max(50).allow('', null),
  pages: Joi.number().integer().min(1).allow(null).messages({
    'number.base': 'Số trang sách phải là số nguyên',
    'number.min': 'Số trang sách phải lớn hơn 0',
  }),
  description: Joi.string().trim().max(5000).allow('', null).messages({
    'string.max': 'Mô tả sách không được vượt quá 5000 ký tự',
  }),
  cover: Joi.object({
    url: Joi.string().trim().uri().allow('', null).messages({
      'string.uri': 'Đường dẫn ảnh bìa không hợp lệ',
    }),
    publicId: Joi.string().trim().allow('', null),
  }).allow(null),
  location: Joi.string().trim().max(100).allow('', null).messages({
    'string.max': 'Vị trí kệ sách không được vượt quá 100 ký tự',
  }),
  status: Joi.string().valid('active', 'hidden').messages({
    'any.only': 'Trạng thái sách chỉ có thể là "active" hoặc "hidden"',
  }),
})
  .min(1)
  .messages({
    'object.min': 'Vui lòng cung cấp ít nhất một trường cần cập nhật',
  });

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'hidden').required().messages({
    'any.only': 'Trạng thái sách chỉ có thể là "active" hoặc "hidden"',
    'any.required': 'Trạng thái là bắt buộc',
  }),
});

const queryAdminBookSchema = Joi.object({
  q: Joi.string().trim().allow(''),
  category: Joi.string().pattern(objectIdRegex).allow(''),
  author: Joi.string().pattern(objectIdRegex).allow(''),
  publisher: Joi.string().pattern(objectIdRegex).allow(''),
  status: Joi.string().valid('active', 'hidden', 'all').default('all'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().trim().allow(''),
});

const queryPublicBookSchema = Joi.object({
  q: Joi.string().trim().allow(''),
  category: Joi.string().pattern(objectIdRegex).allow(''),
  author: Joi.string().pattern(objectIdRegex).allow(''),
  publisher: Joi.string().pattern(objectIdRegex).allow(''),
  year: Joi.number().integer().min(1000).max(currentYear + 1).allow(null, ''),
  available: Joi.boolean().truthy('true', '1').falsy('false', '0'),
  sort: Joi.string().valid('relevance', 'new', 'popular', 'az').allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(12),
});

const suggestQuerySchema = Joi.object({
  q: Joi.string().trim().allow('').default(''),
});

const idOrSlugParamSchema = Joi.object({
  idOrSlug: Joi.string().trim().min(1).max(255).required().messages({
    'string.empty': 'Mã định danh hoặc slug sách không được để trống',
    'any.required': 'Mã định danh hoặc slug sách là bắt buộc',
  }),
});

const relatedQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(20).default(6),
});

module.exports = {
  idParamSchema,
  createBookSchema,
  updateBookSchema,
  updateStatusSchema,
  queryAdminBookSchema,
  queryPublicBookSchema,
  suggestQuerySchema,
  idOrSlugParamSchema,
  relatedQuerySchema,
};

