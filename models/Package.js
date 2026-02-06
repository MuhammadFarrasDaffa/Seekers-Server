// models/Package.js
const mongoose = require("mongoose");

function arrayLimit(val) {
    return val.length > 0;
}

const packageSchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 100 },
    type: { type: String, required: true, unique: true, maxlength: 50 },
    tokens: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, maxlength: 500 },
    features: { type: [String], required: true, validate: [arrayLimit, 'At least one feature is required'] },
    popular: { type: Boolean, default: false },
}, {
    timestamps: true
});

module.exports = mongoose.model("Package", packageSchema);
