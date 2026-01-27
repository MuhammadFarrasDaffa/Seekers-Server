const { PDFParse } = require("pdf-parse");
const { parseCV } = require("../services/JobsAiService");
const User = require("../models/User");

class ResumeController {
  static async parseResume(req, res) {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      if (req.file.mimetype !== "application/pdf") {
        return res.status(400).json({
          success: false,
          message: "Only PDF files are supported",
        });
      }

      // Ekstrak Teks dari Buffer PDF menggunakan pdf-parse
      // req.file.buffer adalah data file yang disimpan sementara di RAM
      const dataBuffer = req.file.buffer;
      const uint8Array = new Uint8Array(dataBuffer);

      const parser = new PDFParse(uint8Array);
      const pdfResult = await parser.getText();
      const extractedText = pdfResult.text;

      if (!extractedText || extractedText.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "Gagal mengekstrak teks dari PDF. Pastikan PDF bukan hasil scan (gambar).",
        });
      }

      // Kirim Teks ke Gemini AI untuk dirapikan
      const structuredProfile = await parseCV(extractedText);

      // Kembalikan hasil ke Frontend (untuk di-review user)
      // Note: Kita belum simpan ke DB User, karena User harus konfirmasi dulu isinya benar/salah
      res.status(200).json({
        success: true,
        message: "CV berhasil dianalisis!",
        data: {
          rawTextPreview: extractedText.substring(0, 200) + "...", // Preview dikit
          parsedProfile: structuredProfile,
        },
      });
    } catch (error) {
      console.error("🚀 ~ ResumeController ~ parseResume ~ error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // New method untuk save parsed CV ke User profile
  static async saveToProfile(req, res) {
    try {
      const { parsedProfile } = req.body;

      if (!parsedProfile || !parsedProfile.profile) {
        return res.status(400).json({
          success: false,
          message: "Invalid profile data",
        });
      }

      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Update user profile dengan data dari CV
      const { profile } = parsedProfile;

      if (parsedProfile.fullName)
        user.profile.fullName = parsedProfile.fullName;
      if (parsedProfile.email) user.profile.email = parsedProfile.email;
      if (profile.title) user.profile.title = profile.title;
      if (profile.summary) user.profile.summary = profile.summary;
      if (profile.location) user.profile.location = profile.location;
      if (profile.skills)
        user.profile.skills = profile.skills.map((skill) =>
          typeof skill === "string" ? { name: skill, level: "" } : skill,
        );
      if (profile.education) user.profile.education = profile.education;
      if (profile.experience) user.profile.experience = profile.experience;

      await user.save();

      res.status(200).json({
        success: true,
        message: "Profile updated successfully from CV",
        profile: user.profile,
      });
    } catch (error) {
      console.error("🚀 ~ ResumeController ~ saveToProfile ~ error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = ResumeController;
