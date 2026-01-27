const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        orderId: {
            type: String,
            required: true,
            unique: true,
        },
        packageType: {
            type: String,
            enum: ["basic", "pro", "premium"],
            required: true,
        },
        tokenAmount: {
            type: Number,
            required: true,
        },
        price: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "success", "failed", "expired"],
            default: "pending",
        },
        transactionId: {
            type: String,
        },
        paymentType: {
            type: String,
        },
        snapToken: {
            type: String,
        },
        snapRedirectUrl: {
            type: String,
        },
        midtransResponse: {
            type: Object,
        },
    },
    {
        timestamps: true,
    }
);

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
