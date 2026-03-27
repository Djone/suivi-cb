const express = require('express');
const router = express.Router();
const validate = require('../middlewares/validation.middleware');
const {
  savingsWalletSchema,
  savingsWalletUpdateSchema,
  savingsWalletAllocationSchema,
  savingsWalletAllocationBatchSchema,
  savingsWalletGlobalAllocationSchema,
} = require('../schemas/savings-wallet.schema');
const savingsWalletController = require('../controllers/savings-wallet.controller');

router.get('/', savingsWalletController.getSavingsWallets);
router.post('/', validate(savingsWalletSchema), savingsWalletController.createSavingsWallet);
router.patch(
  '/:walletId',
  validate(savingsWalletUpdateSchema),
  savingsWalletController.updateSavingsWallet,
);
router.delete('/:walletId', savingsWalletController.deleteSavingsWallet);
router.get('/summary', savingsWalletController.getWalletAllocationSummary);
router.get('/allocations/global', savingsWalletController.getGlobalAllocations);
router.get('/allocations/:transactionId', savingsWalletController.getAllocationsForTransaction);
router.post(
  '/allocations/batch',
  validate(savingsWalletAllocationBatchSchema),
  savingsWalletController.getAllocationsForTransactions,
);
router.post(
  '/allocations',
  validate(savingsWalletAllocationSchema),
  savingsWalletController.setTransactionAllocations,
);
router.post(
  '/allocations/global',
  validate(savingsWalletGlobalAllocationSchema),
  savingsWalletController.setGlobalAllocations,
);
router.patch('/:walletId/close', savingsWalletController.closeSavingsWallet);

module.exports = router;
