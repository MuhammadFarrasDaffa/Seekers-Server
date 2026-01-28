const User = require("../models/User");
const pdfService = require("../services/PdfService");

// @desc    Preview CV as HTML
// @route   GET /api/v1/pdf/preview
// @access  Private
const previewCV = async (req, res, next) => {
  try {
    const { style } = req.query;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found. Please create a profile first.",
      });
    }

    const htmlContent = await pdfService.generatePreviewHTML(
      user.profile,
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

    console.log("📄 Generate PDF Request:", {
      userId: req.user.id,
      template,
      hasCustomProfile: !!customProfile,
    });

    // Use custom profile from request or fetch from database
    let profile;
    if (customProfile) {
      profile = customProfile;
    } else {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          message: "User not found. Please create a profile first.",
        });
      }
      profile = user.profile;
    }

    if (!profile || !profile.fullName) {
      return res.status(400).json({
        message:
          "Profile data is incomplete. Please fill in your profile first.",
      });
    }

    console.log("✅ Profile found:", { fullName: profile.fullName });

    const pdfBuffer = await pdfService.generatePDF(profile, req.user, {
      style: template || "modern",
    });

    // Sanitize filename - remove special characters that cause header issues
    const sanitizedName = (profile.fullName || req.user.name || "User")
      .replace(/[^\w\s-]/g, "") // Remove special chars except spaces and hyphens
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .substring(0, 50); // Limit length

    const fileName = `CV_${sanitizedName}_${Date.now()}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    console.error("❌ PDF Generation Error:", error);
    next(error);
  }
};

module.exports = {
  previewCV,
  generatePDF,
};
