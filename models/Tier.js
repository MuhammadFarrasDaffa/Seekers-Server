// models/Tier.js
const mongoose = require("mongoose");

const tierSchema = new mongoose.Schema({
    title: { type: String, required: true },
    price: { type: Number, required: true },
    benefits: { type: [String], required: true },
    quota: { type: Number, required: true },
    description: { type: String, required: true },
});

module.exports = mongoose.model("Tier", tierSchema);
