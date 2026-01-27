// models/Package.js
const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, required: true, unique: true }, // basic, pro, premium
    tokens: { type: Number, required: true },
    price: { type: Number, required: true },
    description: { type: String },
    features: { type: [String], default: [] },
    popular: { type: Boolean, default: false },
});

module.exports = mongoose.model("Package", packageSchema);
