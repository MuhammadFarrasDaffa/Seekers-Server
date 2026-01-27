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
};
