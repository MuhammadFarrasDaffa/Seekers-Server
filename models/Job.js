// models/Job.js
const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  // --- Basic Info (Dari Listing) ---
  title: { type: String, required: true },
  company: { type: String, required: true },
  location: { type: String, default: "Indonesia" },
  salary: { type: String, default: "Confidential" },
  companyLogo: { type: String },
  jobUrl: { type: String, required: true },
  source: { type: String, default: "Glints" },
  externalId: { type: String, unique: true },
  postedAt: { type: Date, default: Date.now },

  // --- Detail Info (Dari Halaman Detail) ---
  description: { type: String, default: "" }, // HTML format

  // Array Tags
  skills: { type: [String], default: [] },
  requirements: { type: [String], default: [] },
  benefits: { type: [String], default: [] },

  // --- NEW: Info Spesifik Pekerjaan ---
  jobType: { type: String, default: "" }, // e.g. "Penuh Waktu", "Kontrak"
  experienceLevel: { type: String, default: "" }, // e.g. "1 - 3 tahun pengalaman"
  minEducation: { type: String, default: "" }, // e.g. "Minimal Sarjana (S1)"
  lastUpdated: { type: String, default: "" }, // e.g. "Diperbarui Kemarin"

  // --- NEW: Info Lengkap Perusahaan ---
  companyDetails: {
    industry: { type: String, default: "" }, // e.g. "Information Technology"
    size: { type: String, default: "" }, // e.g. "11 - 50 karyawan"
    website: { type: String, default: "" },
    address: { type: String, default: "" }, // Alamat lengkap
    description: { type: String, default: "" }, // Tentang Perusahaan
  },
});

module.exports = mongoose.model("Job", jobSchema);
