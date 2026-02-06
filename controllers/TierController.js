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
                    success: false,
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

    static async createTier(req, res, next) {
        try {
            const { title, price, benefits, quota, description } = req.body;

            const tier = await Tier.create({
                title,
                price,
                benefits: Array.isArray(benefits) ? benefits : benefits.split(',').map(b => b.trim()),
                quota,
                description
            });

            res.status(201).json({
                success: true,
                message: `Tier '${title}' created successfully!`,
                tier
            });
        } catch (error) {
            console.error("Error creating tier:", error);
            next(error);
        }
    }

    static async updateTier(req, res, next) {
        try {
            const { id } = req.params;
            const updateData = { ...req.body };

            // Handle benefits array conversion
            if (updateData.benefits && typeof updateData.benefits === 'string') {
                updateData.benefits = updateData.benefits.split(',').map(b => b.trim()).filter(b => b.length > 0);
            }

            const tier = await Tier.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true, runValidators: true }
            );

            if (!tier) {
                return res.status(404).json({
                    success: false,
                    message: "Tier not found"
                });
            }

            res.status(200).json({
                success: true,
                message: `Tier with ID '${id}' updated successfully!`,
                tier
            });
        } catch (error) {
            console.error("Error updating tier:", error);
            next(error);
        }
    }

    static async deleteTier(req, res, next) {
        try {
            const { id } = req.params;

            const tier = await Tier.findByIdAndDelete(id);

            if (!tier) {
                return res.status(404).json({
                    success: false,
                    message: "Tier not found"
                });
            }

            res.status(200).json({
                success: true,
                message: `Tier with ID '${id}' deleted successfully!`
            });
        } catch (error) {
            console.error("Error deleting tier:", error);
            next(error);
        }
    }
};
