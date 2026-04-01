const Joi = require('joi');

const savingsWalletSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  target_amount: Joi.number().min(0).required(),
});

const savingsWalletUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(255),
  target_amount: Joi.number().min(0),
  is_active: Joi.boolean(),
}).min(1);

const savingsWalletAllocationSchema = Joi.object({
  transaction_id: Joi.number().integer().required(),
  allocations: Joi.array()
    .items(
      Joi.object({
        wallet_id: Joi.number().integer().required(),
        amount: Joi.number().min(0).required(),
      }),
    )
    .required(),
});

const savingsWalletAllocationBatchSchema = Joi.object({
  transaction_ids: Joi.array().items(Joi.number().integer().min(1)).required(),
});

const savingsWalletGlobalAllocationSchema = Joi.object({
  allocations: Joi.array()
    .items(
      Joi.object({
        wallet_id: Joi.number().integer().required(),
        amount: Joi.number().min(0).required(),
      }),
    )
    .required(),
});

module.exports = {
  savingsWalletSchema,
  savingsWalletUpdateSchema,
  savingsWalletAllocationSchema,
  savingsWalletAllocationBatchSchema,
  savingsWalletGlobalAllocationSchema,
};
