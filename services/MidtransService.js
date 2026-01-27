const midtransClient = require("midtrans-client");

// Paket token yang tersedia
const TOKEN_PACKAGES = {
    basic: {
        tokens: 10,
        price: 50000,
        name: "Basic Package",
    },
    pro: {
        tokens: 25,
        price: 100000,
        name: "Pro Package",
    },
    premium: {
        tokens: 50,
        price: 180000,
        name: "Premium Package",
    },
};

class MidtransService {
    constructor() {
        this.snap = new midtransClient.Snap({
            isProduction: false, // Set to true for production
            serverKey: process.env.MIDTRANS_SERVER_KEY,
            clientKey: process.env.MIDTRANS_CLIENT_KEY,
        });

        this.coreApi = new midtransClient.CoreApi({
            isProduction: false,
            serverKey: process.env.MIDTRANS_SERVER_KEY,
            clientKey: process.env.MIDTRANS_CLIENT_KEY,
        });
    }

    /**
     * Get package details
     */
    getPackage(packageType) {
        return TOKEN_PACKAGES[packageType];
    }

    /**
     * Get all packages
     */
    getAllPackages() {
        return TOKEN_PACKAGES;
    }

    /**
     * Create Snap transaction
     */
    async createTransaction(orderId, packageType, customerDetails) {
        const packageData = this.getPackage(packageType);

        if (!packageData) {
            throw new Error("Invalid package type");
        }

        const parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: packageData.price,
            },
            item_details: [
                {
                    id: packageType,
                    price: packageData.price,
                    quantity: 1,
                    name: `${packageData.name} - ${packageData.tokens} Tokens`,
                },
            ],
            customer_details: customerDetails,
            callbacks: {
                finish: `${process.env.CLIENT_URL}/payment/finish`,
                error: `${process.env.CLIENT_URL}/payment/error`,
                pending: `${process.env.CLIENT_URL}/payment/pending`,
            },
        };

        try {
            const transaction = await this.snap.createTransaction(parameter);
            return transaction;
        } catch (error) {
            throw new Error(`Midtrans transaction creation failed: ${error.message}`);
        }
    }

    /**
     * Check transaction status
     */
    async checkTransactionStatus(orderId) {
        try {
            const status = await this.coreApi.transaction.status(orderId);
            return status;
        } catch (error) {
            throw new Error(`Failed to check transaction status: ${error.message}`);
        }
    }

    /**
     * Verify notification from Midtrans
     */
    async verifyNotification(notification) {
        try {
            const statusResponse = await this.coreApi.transaction.notification(
                notification
            );
            return statusResponse;
        } catch (error) {
            throw new Error(`Failed to verify notification: ${error.message}`);
        }
    }

    /**
     * Map Midtrans transaction status to our payment status
     */
    mapTransactionStatus(midtransStatus) {
        const statusMap = {
            capture: "success",
            settlement: "success",
            pending: "pending",
            deny: "failed",
            expire: "expired",
            cancel: "failed",
        };

        return statusMap[midtransStatus] || "pending";
    }
}

module.exports = new MidtransService();
