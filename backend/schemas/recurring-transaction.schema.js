// backend/schemas/recurring-transaction.schema.js
const Joi = require("joi");

const MONTHS_ERROR_MSG = "active_months doit contenir des mois 1..12";

function validateMonthsString(value, helpers, { exactCount, minCount } = {}) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return helpers.error("any.invalid");
  }

  let arr;
  try {
    arr = raw.startsWith("[")
      ? JSON.parse(raw)
      : raw.split(",").map((v) => parseInt(v.trim(), 10));
  } catch {
    return helpers.error("any.invalid");
  }

  if (!Array.isArray(arr) || arr.length === 0) {
    return helpers.error("any.invalid");
  }

  const sanitized = arr.filter(
    (m) => Number.isInteger(m) && m >= 1 && m <= 12
  );
  if (sanitized.length !== arr.length) {
    return helpers.error("any.invalid");
  }

  if (typeof exactCount === "number" && sanitized.length !== exactCount) {
    return helpers.error("any.invalid");
  }
  if (typeof minCount === "number" && sanitized.length < minCount) {
    return helpers.error("any.invalid");
  }

  return value;
}

const recurringTransactionSchema = Joi.object({
  id: Joi.number().integer().positive().optional(),

  label: Joi.string()
    .min(2)
    .max(255)
    .required()
    .description("Le libellé de la transaction récurrente"),

  amount: Joi.number()
    .precision(2)
    .positive()
    .required()
    .description("Le montant de la transaction"),

  day_of_month: Joi.number()
    .integer()
    .min(1)
    .max(31)
    .required()
    .description(
      "Le jour du mois (1-31) ou le jour de la semaine (1-7) pour hebdomadaire"
    ),

  frequency: Joi.string()
    .valid("weekly", "monthly", "bimonthly", "quarterly", "biannual", "yearly")
    .default("monthly")
    .description("La périodicité de la transaction récurrente"),

  account_id: Joi.number()
    .integer()
    .positive()
    .required()
    .description("L'ID du compte"),

  sub_category_id: Joi.number()
    .integer()
    .positive()
    .required()
    .description("L'ID de la sous-catégorie"),

  financial_flow_id: Joi.number()
    .integer()
    .positive()
    .required()
    .description("L'ID du flux financier (1=Revenu, 2=Dépense)"),

  debit_503020: Joi.number()
    .integer()
    .positive()
    .required()
    .description(
      "L'ID du type débit de la répartition 50/30/20 (1=Charges fixes, 2=Loisir, 3=Epargne)"
    ),

  // Version 1.1.0
  // Pour les transactions récurrentes à durée limitée
  start_month: Joi.number()
    .integer()
    .min(1)
    .max(12)
    .allow(null)
    .when("recurrence_kind", {
      is: "installment",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  occurrences: Joi.number()
    .integer()
    .min(1)
    .when("recurrence_kind", {
      is: "installment",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  // On accepte une chaîne (CSV ou JSON) et null si non saisonnier
  active_months: Joi.alternatives()
    .conditional("recurrence_kind", {
      is: "seasonal",
      then: Joi.string()
        .required()
        .custom((value, helpers) =>
          validateMonthsString(value, helpers, { minCount: 1 })
        ),
      otherwise: Joi.alternatives().conditional("frequency", {
        switch: [
          {
            is: "yearly",
            then: Joi.string()
              .required()
              .custom((value, helpers) =>
                validateMonthsString(value, helpers, { exactCount: 1 })
              ),
          },
          {
            is: "biannual",
            then: Joi.string()
              .required()
              .custom((value, helpers) =>
                validateMonthsString(value, helpers, { exactCount: 2 })
              ),
          },
          {
            is: "quarterly",
            then: Joi.string()
              .required()
              .custom((value, helpers) =>
                validateMonthsString(value, helpers, { exactCount: 3 })
              ),
          },
        ],
        otherwise: Joi.string().allow(null).optional(),
      }),
    })
    .messages({ "any.invalid": MONTHS_ERROR_MSG }),
  recurrence_kind: Joi.string()
    .allow(null)
    .valid("permanent", "installment", "seasonal")
    .optional(),
});

module.exports = { recurringTransactionSchema };
