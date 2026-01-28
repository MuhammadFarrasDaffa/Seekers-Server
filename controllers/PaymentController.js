const Payment = require("../models/Payment");
const User = require("../models/User");
const midtransService = require("../services/MidtransService");

class PaymentController {
    /**
     * Get all available token packages
     */
    static async getPackages(req, res, next) {
        try {
            const packages = await midtransService.getAllPackages();
            res.status(200).json({
                success: true,
                packages: packages,
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
            const packageData = await midtransService.getPackage(packageType);
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
            console.log("📥 Received Midtrans notification:", notification);

            console.log("INI ISI NOTIFIKASI", { notification });

            // Verify signature key to ensure notification is from Midtrans
            const { order_id, status_code, gross_amount, signature_key } = notification;

            const isValidSignature = midtransService.verifySignatureKey(
                order_id,
                status_code,
                gross_amount,
                signature_key
            );

            if (!isValidSignature) {
                console.error("❌ Invalid signature key! Notification might not be from Midtrans");
                return res.status(403).json({
                    success: false,
                    message: "Invalid signature key",
                });
            }

            console.log("✅ Signature verified - notification is from Midtrans");

            // Verify notification with Midtrans
            const statusResponse = await midtransService.verifyNotification(
                notification
            );

            const { transaction_status, fraud_status, payment_type } =
                statusResponse;

            console.log(`💳 Transaction ${order_id} status: ${transaction_status}`);

            // Find payment in database
            const payment = await Payment.findOne({ orderId: order_id });
            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: "Payment not found",
                });
            }

            // Prevent processing already successful payments
            if (payment.status === "success") {
                console.log(`⚠️ Payment ${order_id} already processed as success. Skipping...`);
                return res.status(200).json({
                    success: true,
                    message: "Payment already processed",
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

            console.log(`✅ Updating payment ${order_id} to status: ${paymentStatus}`);

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
                    console.log(`🎁 Added ${payment.tokenAmount} tokens to user ${user.email}`);
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

            // Check and update ONLY expired pending payments (older than 5 minutes)
            const now = new Date();
            const pendingPayments = payments.filter(p => {
                if (p.status !== "pending") return false;

                // Calculate time difference in minutes
                const createdAt = new Date(p.createdAt);
                const minutesPassed = (now - createdAt) / (1000 * 60);

                // Only check if payment is older than 5 minutes (expiry time)
                return minutesPassed > 5;
            });

            for (const payment of pendingPayments) {
                try {
                    // Check status from Midtrans
                    const statusResponse = await midtransService.checkTransactionStatus(
                        payment.orderId
                    );

                    const newStatus = midtransService.mapTransactionStatus(
                        statusResponse.transaction_status
                    );

                    // Update if status changed
                    if (payment.status !== newStatus) {
                        payment.status = newStatus;
                        payment.midtransResponse = statusResponse;
                        await payment.save();
                        console.log(`🔄 Auto-updated payment ${payment.orderId} from pending to ${newStatus}`);
                    }
                } catch (error) {
                    // If error 404 or transaction not found, mark as expired
                    if (error.message.includes("404") || error.message.includes("not found")) {
                        payment.status = "expired";
                        await payment.save();
                        console.log(`⏱️ Payment ${payment.orderId} expired (not found in Midtrans)`);
                    } else {
                        console.error(`Error checking status for ${payment.orderId}:`, error.message);
                    }
                }
            }

            // Fetch updated payments
            const updatedPayments = await Payment.find({ userId })
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const count = await Payment.countDocuments({ userId });

            res.status(200).json({
                success: true,
                data: updatedPayments,
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
