// models/Tier.js
const mongoose = require("mongoose");

function arrayLimit(val) {
    return val.length > 0;
}

const tierSchema = new mongoose.Schema({
    title: { type: String, required: true, maxlength: 100 },
    price: { type: Number, required: true, min: 1 },
    benefits: { 
        type: [String], 
        required: true,
        validate: [arrayLimit, 'At least one benefit is required']
    },
    quota: { type: Number, required: true, min: 1 },
    description: { type: String, required: true, maxlength: 500 },
}, {
    timestamps: true
});

module.exports = mongoose.model("Tier", tierSchema);
