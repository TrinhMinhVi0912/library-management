const Joi = require('joi');

const adminStatisticsSectionSchema = Joi.object({
  section: Joi.string()
    .valid('loans', 'renewals', 'fines', 'users', 'staff', 'forum', 'notifications', 'catalog')
    .required(),
});

module.exports = { adminStatisticsSectionSchema };
