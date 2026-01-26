const { PDFParse } = require("pdf-parse");
const { parseCV } = require("../services/JobsAiService");

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

            // 5. Kembalikan hasil ke Frontend (untuk di-review user)
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
}

module.exports = ResumeController;
