const Job = require("../models/Job");
const { analyzeMatch } = require("../services/JobsAiService");

class JobController {
    static async getAllJobs(req, res) {
        try {
            // A. Ambil Query Parameters dari URL
            // Contoh: /jobs?page=1&limit=10&search=react&location=jakarta&type=fulltime
            const { page = 1, limit = 12, search, location, type, sort } = req.query;

            // B. Bangun Query Database
            const query = {};

            // Logic Search (Judul atau Perusahaan)
            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: "i" } }, // 'i' = case insensitive (huruf besar/kecil sama aja)
                    { company: { $regex: search, $options: "i" } },
                    { skills: { $regex: search, $options: "i" } }, // Cari juga di skill
                ];
            }

            // Logic Filter Lokasi
            if (location) {
                query.location = { $regex: location, $options: "i" };
            }

            // Logic Filter Tipe Pekerjaan (Fulltime/Contract)
            if (type) {
                query.jobType = { $regex: type, $options: "i" };
            }

            // C. Eksekusi Query dengan Pagination
            const jobs = await Job.find(query)
                .limit(limit * 1) // Batasi jumlah data
                .skip((page - 1) * limit) // Lewati data halaman sebelumnya
                .sort({ postedAt: -1 }); // Urutkan dari yang terbaru (postedAt Descending)

            // Hitung total data (untuk info pagination di frontend)
            const count = await Job.countDocuments(query);

            // D. Kirim Response
            res.status(200).json({
                success: true,
                data: jobs,
                pagination: {
                    totalData: count,
                    totalPages: Math.ceil(count / limit),
                    currentPage: page,
                    perPage: limit,
                },
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async getJobById(req, res) {
        try {
            const job = await Job.findOne({ externalId: req.params.id });
            // Catatan: Kita pakai externalId (ID dari Glints) atau _id (ID Mongo) terserah kesepakatan.
            // Kalau mau pakai _id mongo: await Job.findById(req.params.id);

            if (!job) {
                return res
                    .status(404)
                    .json({ success: false, message: "Lowongan tidak ditemukan" });
            }

            res.status(200).json({
                success: true,
                data: job,
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async analyzeJobMatch(req, res) {
        try {
            const { id } = req.params; // ID Job

            // Nanti: const userId = req.user.id;
            // Sekarang (Testing): Kita terima object profile mentah dari frontend
            const { userProfile } = req.body;

            if (!userProfile || !userProfile.profile) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Data profil user tidak ditemukan. Pastikan sudah upload CV.",
                });
            }

            // 1. Ambil Data Job
            const job = await Job.findOne({ externalId: id });
            if (!job) {
                return res
                    .status(404)
                    .json({ success: false, message: "Lowongan tidak ditemukan" });
            }

            // 2. Analisis Kecocokan (Object vs Object)
            const analysisResult = await analyzeMatch(job, userProfile);

            // 3. Kirim Hasil
            res.status(200).json({
                success: true,
                data: analysisResult,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = JobController;
