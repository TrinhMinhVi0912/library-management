const ApiError = require('../api-error');

/**
 * Định dạng danh sách lỗi từ Joi ValidationError
 * @param {import('joi').ValidationError} error
 */
const formatJoiErrors = (error) => {
  return error.details.map((detail) => ({
    field: detail.path.join('.'),
    message: detail.message.replace(/['"]/g, ''),
  }));
};

/**
 * Middleware validate dữ liệu request bằng Joi schema
 * Hỗ trợ 2 cách dùng:
 * 1. validate(singleSchema, 'body' | 'query' | 'params')
 * 2. validate({ body: schemaBody, query: schemaQuery, params: schemaParams })
 *
 * @param {object} schema Joi Schema hoặc object map các nguồn { body, query, params }
 * @param {'body'|'query'|'params'} [source='body'] Nguồn dữ liệu cần kiểm tra nếu truyền schema đơn
 */
const validate = (schema, source = 'body') => {
  return (req, _res, next) => {
    if (!schema) {
      return next(ApiError.internal('Schema validate không được cung cấp'));
    }

    // Trường hợp 1: schema là Joi Schema đơn (có hàm .validate)
    if (typeof schema.validate === 'function') {
      const dataToValidate = req[source] || {};
      const { value, error } = schema.validate(dataToValidate, {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false,
      });

      if (error) {
        return next(
          ApiError.unprocessableEntity('Dữ liệu không hợp lệ', formatJoiErrors(error))
        );
      }

      req[source] = value;
      return next();
    }

    // Trường hợp 2: schema là object cấu hình nhiều nguồn { body?, query?, params? }
    const sources = ['params', 'query', 'body'];
    const allErrors = [];

    for (const src of sources) {
      if (schema[src] && typeof schema[src].validate === 'function') {
        const dataToValidate = req[src] || {};
        const { value, error } = schema[src].validate(dataToValidate, {
          abortEarly: false,
          stripUnknown: true,
          allowUnknown: false,
        });

        if (error) {
          allErrors.push(...formatJoiErrors(error));
        } else {
          req[src] = value;
        }
      }
    }

    if (allErrors.length > 0) {
      return next(ApiError.unprocessableEntity('Dữ liệu không hợp lệ', allErrors));
    }

    next();
  };
};

module.exports = validate;
module.exports.validate = validate;

