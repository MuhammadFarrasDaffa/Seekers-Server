// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  // --- Data Akun Dasar ---
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Nanti di-hash
  role: { type: String, enum: ["user", "admin"], default: "user" },
  token: { type: Number, default: 0 }, // Token penggunaan AI
  // --- Data Profil Profesional (Hasil Ekstraksi CV) ---
  // AI akan mengisi bagian ini otomatis nanti
  profile: {
    email: { type: String, default: "" },
    fullName: { type: String, default: "" },
    title: { type: String, default: "" }, // e.g. "Software Engineer"
    summary: { type: String, default: "" }, // Professional Summary
    location: { type: String, default: "" },
    phone: { type: String, default: "" },
    aiSummary: { type: String, default: "" }, // Profesional summary yang dibuat AI
    linkedIn: { type: String, default: "" },
    github: { type: String, default: "" },
    portfolio: { type: String, default: "" },

    // Skill kita simpan sebagai Array string agar mudah di-match dengan Job
    skills: { type: [String], default: [] },

    // Riwayat Pendidikan
    education: [
      {
        institution: { type: String },
        degree: { type: String },
        fieldOfStudy: { type: String },
        grade: { type: String },
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
        description: [{ type: String }], // AI akan baca ini untuk cari keyword
      },
    ],

    skills: [
      {
        name: {
          type: String,
          required: true,
        },
        level: {
          type: String,
        },
      },
    ],
    certifications: [
      {
        name: {
          type: String,
          required: true,
        },
        issuer: {
          type: String,
        },
        year: {
          type: String,
        },
      },
    ],
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
