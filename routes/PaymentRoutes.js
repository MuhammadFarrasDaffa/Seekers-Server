const express = require("express");
const PaymentController = require("../controllers/PaymentController");
const Authentication = require("../middleware/Authentication");

const router = express.Router();

// Public routes
router.get("/packages", PaymentController.getPackages);
router.post("/notification", PaymentController.handleNotification); // Webhook from Midtrans

// Protected routes (require authentication)
router.use(Authentication);

router.post("/create", PaymentController.createPayment);
router.get("/status/:orderId", PaymentController.checkStatus);
router.get("/history", PaymentController.getPaymentHistory);
router.get("/balance", PaymentController.getTokenBalance);

module.exports = router;
