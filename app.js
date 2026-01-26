if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const express = require("express");
const app = express();
const cors = require('cors')
const router = require("./routes");
const mongoose = require("mongoose");
const initScheduler = require("./utils/scheduler");
const errorHandler = require("./middleware/ErrorHandler");
const { scrapeGlints } = require("./services/JobsScraperService");

app.use(cors())

app.use(express.urlencoded({ extended: false }));

app.use(express.json());

app.use(router);

app.use(errorHandler);

const startServer = async () => {
    try {
        // 1. Connect DB dulu
        await mongoose.connect(process.env.CONNECTION_STRING_MONGODB);
        console.log("✅ MongoDB Connected! Siap menerima data.");

        // 2. Baru jalankan Scheduler & Server
        initScheduler();

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Gagal connect ke MongoDB:", error);
        process.exit(1);
    }
};

// Jalankan fungsi start
startServer();

app.get("/", (req, res) => res.send("Server Ready 🚀"));

app.post("/scrape-manual", async (req, res) => {

    if (mongoose.connection.readyState !== 1) {
        return res.status(500).json({ error: "Database belum terkoneksi!" });
    }

    console.log("⚠️ Trigger scraping manual...");
    scrapeGlints(); // Background process
    res.json({ message: "Scraping dimulai! Cek terminal." });
});