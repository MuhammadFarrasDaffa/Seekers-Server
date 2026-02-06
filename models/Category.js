// models/Category.js
const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 500 },
    imgUrl: { type: String, required: true, maxlength: 300 },
    level: {
        junior: { type: Boolean, default: false },
        middle: { type: Boolean, default: false },
        senior: { type: Boolean, default: false },
    },
    published: { type: Boolean, default: false },
}, {
    timestamps: true
});

module.exports = mongoose.model("Category", categorySchema);
