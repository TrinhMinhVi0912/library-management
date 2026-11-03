const Joi = require('joi');

const dashboardChartsQuerySchema = Joi.object({
  range: Joi.string().valid('7d', '30d', '12m').default('30d'),
});

const reportDateRangeSchema = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso(),
}).custom((value, helpers) => {
  if (value.from && value.to && value.from > value.to) {
    return helpers.message('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');
  }
  return value;
});

module.exports = { dashboardChartsQuerySchema, reportDateRangeSchema };
