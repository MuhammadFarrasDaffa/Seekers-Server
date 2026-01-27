const Payment = require("../models/Payment");
const User = require("../models/User");
const midtransService = require("../services/MidtransService");

class PaymentController {
    /**
     * Get all available token packages
     */
    static async getPackages(req, res, next) {
        try {
            const packages = midtransService.getAllPackages();
            res.status(200).json({
                success: true,
                data: packages,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Create new payment transaction
     */
    static async createPayment(req, res, next) {
        try {
            const { packageType } = req.body;
            const userId = req.user.id;

            // Validate package type
            const packageData = midtransService.getPackage(packageType);
            if (!packageData) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid package type",
                });
            }

            // Get user data
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            // Generate unique order ID
            const orderId = `ORDER-${userId}-${Date.now()}`;

            // Customer details for Midtrans
            const customerDetails = {
                first_name: user.name,
                email: user.email,
                phone: user.profile?.phone || "",
            };

            // Create transaction with Midtrans
            const midtransTransaction = await midtransService.createTransaction(
                orderId,
                packageType,
                customerDetails
            );

            // Save payment to database
            const payment = await Payment.create({
                userId: userId,
                orderId: orderId,
                packageType: packageType,
                tokenAmount: packageData.tokens,
                price: packageData.price,
                snapToken: midtransTransaction.token,
                snapRedirectUrl: midtransTransaction.redirect_url,
                status: "pending",
            });

            res.status(201).json({
                success: true,
                data: {
                    orderId: payment.orderId,
                    snapToken: payment.snapToken,
                    redirectUrl: payment.snapRedirectUrl,
                    packageType: payment.packageType,
                    tokenAmount: payment.tokenAmount,
                    price: payment.price,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Handle Midtrans notification/callback
     */
    static async handleNotification(req, res, next) {
        try {
            const notification = req.body;

            // Verify notification with Midtrans
            const statusResponse = await midtransService.verifyNotification(
                notification
            );

            const { order_id, transaction_status, fraud_status, payment_type } =
                statusResponse;

            // Find payment in database
            const payment = await Payment.findOne({ orderId: order_id });
            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: "Payment not found",
                });
            }

            // Map Midtrans status to our status
            let paymentStatus = midtransService.mapTransactionStatus(
                transaction_status
            );

            // Handle fraud status
            if (transaction_status === "capture") {
                if (fraud_status === "challenge") {
                    paymentStatus = "pending";
                } else if (fraud_status === "accept") {
                    paymentStatus = "success";
                }
            }

            // Update payment status
            payment.status = paymentStatus;
            payment.paymentType = payment_type;
            payment.transactionId = statusResponse.transaction_id;
            payment.midtransResponse = statusResponse;
            await payment.save();

            // If payment successful, add tokens to user
            if (paymentStatus === "success") {
                const user = await User.findById(payment.userId);
                if (user) {
                    user.token += payment.tokenAmount;
                    await user.save();
                }
            }

            res.status(200).json({
                success: true,
                message: "Notification processed",
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Check payment status
     */
    static async checkStatus(req, res, next) {
        try {
            const { orderId } = req.params;

            // Find payment in database
            const payment = await Payment.findOne({ orderId });
            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: "Payment not found",
                });
            }

            // Check status from Midtrans
            const statusResponse = await midtransService.checkTransactionStatus(
                orderId
            );

            // Update payment status
            const newStatus = midtransService.mapTransactionStatus(
                statusResponse.transaction_status
            );

            if (payment.status !== newStatus) {
                payment.status = newStatus;
                payment.midtransResponse = statusResponse;
                await payment.save();

                // If payment successful, add tokens to user
                if (newStatus === "success") {
                    const user = await User.findById(payment.userId);
                    if (user) {
                        user.token += payment.tokenAmount;
                        await user.save();
                    }
                }
            }

            res.status(200).json({
                success: true,
                data: {
                    orderId: payment.orderId,
                    status: payment.status,
                    packageType: payment.packageType,
                    tokenAmount: payment.tokenAmount,
                    price: payment.price,
                    createdAt: payment.createdAt,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get user payment history
     */
    static async getPaymentHistory(req, res, next) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 10 } = req.query;

            const payments = await Payment.find({ userId })
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const count = await Payment.countDocuments({ userId });

            res.status(200).json({
                success: true,
                data: payments,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get user current token balance
     */
    static async getTokenBalance(req, res, next) {
        try {
            const userId = req.user.id;
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            res.status(200).json({
                success: true,
                data: {
                    tokenBalance: user.token,
                },
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = PaymentController;
