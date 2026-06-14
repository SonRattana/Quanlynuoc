const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/online', verifyToken, orderController.createOnlineOrder);
router.get('/', verifyToken, orderController.getAllOrders);
router.put('/:id/status', verifyToken, orderController.updateOrderStatus);
router.get('/public/lookup', orderController.lookupOrdersByEmail);
router.get('/count-pending', orderController.countPendingOrders);
router.get('/admin-details/:id', orderController.getAdminOrderDetails);
router.get('/:id', orderController.getOrderById);

module.exports = router;