const Joi = require("joi");
const money = () => Joi.number().min(0).max(100000000).precision(2).strict();
module.exports = Joi.object({
  month: Joi.string()
    .pattern(/^\d{4}-(0[1-9]|1[0-2])-01$/)
    .required(),
  ets: Joi.string().valid("CST", "CAP", "SDG", "ATS", "OTHER").required(),
  company: Joi.string().trim().max(200).allow("").default(""),
  gross: money().required(),
  net: money().required(),
  netTaxable: money().required(),
  pas: money().default(0),
  rounding: Joi.number()
    .min(-100000000)
    .max(100000000)
    .precision(2)
    .strict()
    .default(0),
  bonus: money().default(0),
  donations: money().default(0),
  comment: Joi.string().max(4000).allow("").default(""),
  tenureStart: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .custom((value, helpers) => {
      const date = new Date(value + "T00:00:00Z");
      return Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
        ? value
        : helpers.error("any.invalid");
    })
    .allow(null)
    .default(null),
});
