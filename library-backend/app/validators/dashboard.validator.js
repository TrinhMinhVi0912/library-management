const Joi = require('joi');

const dashboardChartsQuerySchema = Joi.object({
  range: Joi.string().valid('7d', '30d', '12m').default('30d'),
});

const reportDateRangeSchema = Joi.object({
  from: Joi.string().isoDate().raw(),
  to: Joi.string().isoDate().raw(),
}).custom((value, helpers) => {
  if (value.from && value.to && new Date(value.from) > new Date(value.to)) {
    return helpers.message('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');
  }
  return value;
});

module.exports = { dashboardChartsQuerySchema, reportDateRangeSchema };
