// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    // --- Data Akun Dasar ---
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Nanti di-hash
    role: { type: String, enum: ["user", "admin"], default: "user" },

    // --- Data Profil Profesional (Hasil Ekstraksi CV) ---
    // AI akan mengisi bagian ini otomatis nanti
    profile: {
        title: { type: String, default: "" }, // e.g. "Software Engineer"
        summary: { type: String, default: "" }, // Professional Summary
        location: { type: String, default: "" },

        // Skill kita simpan sebagai Array string agar mudah di-match dengan Job
        skills: { type: [String], default: [] },

        // Riwayat Pendidikan
        education: [
            {
                institution: { type: String },
                degree: { type: String },
                fieldOfStudy: { type: String },
                startDate: { type: Date },
                endDate: { type: Date },
                description: { type: String },
            },
        ],

        // Pengalaman Kerja (PENTING untuk Matching)
        experience: [
            {
                company: { type: String },
                position: { type: String }, // Cocokkan dengan Job Title
                startDate: { type: Date },
                endDate: { type: Date },
                isCurrent: { type: Boolean, default: false },
                description: { type: String }, // AI akan baca ini untuk cari keyword
            },
        ],

        // Simpan link file CV asli (PDF) jika user mau download lagi
        resumeUrl: { type: String, default: "" },

        // Simpan teks mentah hasil parsing PDF (opsional, buat backup analisis)
        resumeText: { type: String, select: false }, // select: false biar gak berat saat query biasa
    },

    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
