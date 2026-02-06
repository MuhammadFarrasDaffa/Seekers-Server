// controllers/PackageController.js
const Package = require('../models/Package');

module.exports = class PackageController {
    static async getAllPackages(req, res, next) {
        try {
            const packages = await Package.find().sort({ price: 1 });

            res.status(200).json({
                success: true,
                packages
            });
        } catch (error) {
            console.error("Error fetching packages:", error);
            next(error);
        }
    }

    static async getPackageById(req, res, next) {
        try {
            const { id } = req.params;
            const package_ = await Package.findById(id);

            if (!package_) {
                return res.status(404).json({
                    success: false,
                    message: "Package tidak ditemukan"
                });
            }

            res.status(200).json({
                success: true,
                package: package_
            });
        } catch (error) {
            console.error("Error fetching package:", error);
            next(error);
        }
    }

    static async getPackageByType(req, res, next) {
        try {
            const { type } = req.params;
            const package_ = await Package.findOne({ type });

            if (!package_) {
                return res.status(404).json({
                    success: false,
                    message: "Package tidak ditemukan"
                });
            }

            res.status(200).json({
                success: true,
                package: package_
            });
        } catch (error) {
            console.error("Error fetching package:", error);
            next(error);
        }
    }

    static async createPackage(req, res, next) {
        try {
            const { name, type, tokens, price, description, features, popular } = req.body;

            const package_ = await Package.create({
                name,
                type,
                tokens,
                price,
                description,
                features: Array.isArray(features) ? features : features.split(',').map(f => f.trim()),
                popular: popular || false
            });

            res.status(201).json({
                success: true,
                message: `Package '${name}' created successfully!`,
                package: package_
            });
        } catch (error) {
            console.error("Error creating package:", error);
            next(error);
        }
    }

    static async updatePackage(req, res, next) {
        try {
            const { id } = req.params;
            const updateData = { ...req.body };

            // Handle features array conversion
            if (updateData.features && typeof updateData.features === 'string') {
                updateData.features = updateData.features.split(',').map(f => f.trim()).filter(f => f.length > 0);
            }

            const package_ = await Package.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true, runValidators: true }
            );

            if (!package_) {
                return res.status(404).json({
                    success: false,
                    message: "Package not found"
                });
            }

            res.status(200).json({
                success: true,
                message: `Package with ID '${id}' updated successfully!`,
                package: package_
            });
        } catch (error) {
            console.error("Error updating package:", error);
            next(error);
        }
    }

    static async deletePackage(req, res, next) {
        try {
            const { id } = req.params;

            const package_ = await Package.findByIdAndDelete(id);

            if (!package_) {
                return res.status(404).json({
                    success: false,
                    message: "Package not found"
                });
            }

            res.status(200).json({
                success: true,
                message: `Package with ID '${id}' deleted successfully!`
            });
        } catch (error) {
            console.error("Error deleting package:", error);
            next(error);
        }
    }
};
