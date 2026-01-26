// utils/scheduler.js
const cron = require("node-cron");
const { scrapeGlints } = require("../services/JobsScraperService");

const initScheduler = () => {
    console.log("⏰ Scheduler aktif: Menunggu jam 00:00 WIB untuk scraping...");

    // Jadwal: Setiap jam 00:00 (Midnight)
    cron.schedule(
        "0 0 * * *",
        () => {
            console.log("🕛 Waktunya scraping otomatis!");
            scrapeGlints();
        },
        {
            scheduled: true,
            timezone: "Asia/Jakarta",
        },
    );
};

module.exports = initScheduler;
