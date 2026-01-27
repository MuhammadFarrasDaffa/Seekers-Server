// controllers/TierController.js
const Tier = require('../models/Tier');

module.exports = class TierController {
    static async getAllTiers(req, res, next) {
        try {
            const tiers = await Tier.find().sort({ price: 1 });

            res.status(200).json({
                success: true,
                tiers
            });
        } catch (error) {
            console.error("Error fetching tiers:", error);
            next(error);
        }
    }

    static async getTierById(req, res, next) {
        try {
            const { id } = req.params;
            const tier = await Tier.findById(id);

            if (!tier) {
                return res.status(404).json({
                    message: "Tier tidak ditemukan"
                });
            }

            res.status(200).json({
                success: true,
                tier
            });
        } catch (error) {
            console.error("Error fetching tier:", error);
            next(error);
        }
    }
};
