// models/Category.js
const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "" },
    level: {
        junior: { type: Boolean, default: false },
        middle: { type: Boolean, default: false },
        senior: { type: Boolean, default: false },
    },
    published: { type: Boolean, default: false },
});

module.exports = mongoose.model("Category", categorySchema);
