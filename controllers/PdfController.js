const Profile = require("../models/User");

// const Profile = require("../models/Profile");

const pdfService = require("../services/PdfService");

// @desc    Preview CV as HTML
// @route   GET /api/v1/pdf/preview
// @access  Private
const previewCV = async (req, res, next) => {
    try {
        const { style } = req.query;

        const profile = await Profile.findOne({ userId: req.user._id });

        if (!profile) {
            return res.status(404).json({
                message: "Profile not found. Please create a profile first.",
            });
        }

        const htmlContent = await pdfService.generatePreviewHTML(
            profile,
            req.user,
            style || "modern",
        );

        res.setHeader("Content-Type", "text/html");
        res.send(htmlContent);
    } catch (error) {
        next(error);
    }
};

// @desc    Generate and download PDF
// @route   POST /api/v1/pdf/generate
// @access  Private
const generatePDF = async (req, res, next) => {
    try {
        const { template, profile: customProfile } = req.body;

        // Use custom profile from request or fetch from database
        let profile;
        if (customProfile) {
            profile = customProfile;
        } else {
            profile = await Profile.findOne({ userId: req.user._id });
        }

        if (!profile) {
            return res.status(404).json({
                message: "Profile not found. Please create a profile first.",
            });
        }

        const pdfBuffer = await pdfService.generatePDF(profile, req.user, {
            style: template || "modern",
        });

        const fileName = `CV_${profile.fullName || req.user.name}_${Date.now()}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.setHeader("Content-Length", pdfBuffer.length);

        res.send(pdfBuffer);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    previewCV,
    generatePDF,
};
