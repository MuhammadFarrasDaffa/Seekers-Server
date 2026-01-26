const puppeteer = require("puppeteer");
const Job = require("../models/Job");

const TARGET_URLS = [
    "https://glints.com/id/opportunities/jobs/explore?keyword=Software+Engineer&country=ID&locationName=Indonesia",
    "https://glints.com/id/opportunities/jobs/explore?keyword=Data+Analyst&country=ID&locationName=Indonesia",
    "https://glints.com/id/opportunities/jobs/explore?keyword=UI%2FUX+Designer&country=ID&locationName=Indonesia",
];

const scrapeGlints = async () => {
    console.log("🚀 Memulai FINAL Scraping (Fixed Skills & Benefits)...");

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--window-size=1920,1080",
        ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    );

    try {
        let allCollectedJobs = [];

        // --- STEP 1: LISTING (Tidak Berubah) ---
        for (const url of TARGET_URLS) {
            console.log(
                `\n🔎 Scanning: ${url.split("keyword=")[1].split("&")[0]} ...`,
            );
            try {
                await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
                try {
                    await page.waitForSelector(
                        '[data-glints-tracking-element-name="job_card"]',
                        { timeout: 10000 },
                    );
                } catch (e) { }

                const jobsInPage = await page.evaluate(() => {
                    const results = [];
                    const cards = document.querySelectorAll(
                        '[data-glints-tracking-element-name="job_card"]',
                    );
                    cards.forEach((card) => {
                        const titleEl = card.querySelector("h2");
                        const linkEl = card.querySelector(
                            'a[href*="/opportunities/jobs/"]',
                        );
                        const companyEl = card.querySelector('a[href*="/companies/"]');
                        const locationEl = card.querySelector('[class*="LocationWrapper"]');
                        const salaryEl = card.querySelector('[class*="SalaryWrapper"]');

                        if (titleEl && linkEl) {
                            const jobUrl = linkEl.href;
                            results.push({
                                title: titleEl.innerText.trim(),
                                company: companyEl
                                    ? companyEl.innerText.trim()
                                    : "Confidential",
                                location: locationEl
                                    ? locationEl.innerText.trim()
                                    : "Indonesia",
                                salary: salaryEl ? salaryEl.innerText.trim() : "Confidential",
                                jobUrl: jobUrl,
                                externalId: jobUrl.split("/").pop().split("?")[0],
                            });
                        }
                    });
                    return results;
                });
                console.log(`   ✅ Ditemukan ${jobsInPage.length} lowongan.`);
                allCollectedJobs = [...allCollectedJobs, ...jobsInPage];
            } catch (err) {
                console.error(`❌ Skip URL:`, err.message);
            }
        }

        for (const job of allCollectedJobs) {
            await Job.findOneAndUpdate({ externalId: job.externalId }, job, {
                upsert: true,
            });
        }

        // --- STEP 2: DEEP SCRAPING (PARSING FIX) ---
        const jobsToDetail = allCollectedJobs;

        console.log(`\n🕵️‍♂️ Extracting FULL INFO for ${jobsToDetail.length} jobs...`);

        for (let i = 0; i < jobsToDetail.length; i++) {
            const job = jobsToDetail[i];
            if (!job.jobUrl.includes("http")) continue;

            console.log(`[${i + 1}/${jobsToDetail.length}] Parsing: ${job.company}`);

            try {
                await page.goto(job.jobUrl, {
                    waitUntil: "domcontentloaded",
                    timeout: 30000,
                });
                await new Promise((r) => setTimeout(r, 2000));

                const detailData = await page.evaluate(() => {
                    const mainContent = document.querySelector("main");

                    let data = {
                        descriptionHTML: "",
                        skills: [],
                        requirements: [],
                        benefits: [],
                        jobType: "",
                        experienceLevel: "",
                        minEducation: "",
                        lastUpdated: "",
                        companyDetails: {
                            industry: "",
                            size: "",
                            website: "",
                            address: "",
                            description: "",
                        },
                    };

                    if (mainContent) {
                        // 1. DESKRIPSI (HTML)
                        // Cari container deskripsi yang paling mungkin
                        const descContainer = mainContent.querySelector(
                            '[class*="JobDescriptionsc__DescriptionContainer"]',
                        );
                        if (descContainer) {
                            data.descriptionHTML = descContainer.innerHTML;
                        } else {
                            // Fallback: Ambil text kasar jika HTML container tidak ketemu
                            data.descriptionHTML = mainContent.innerText;
                        }

                        // 2. PARSING TAGS (LOGIC BARU: TRAVERSAL IBU/NENEK) 🛡️
                        const headers = Array.from(mainContent.querySelectorAll("h2"));

                        headers.forEach((h2) => {
                            const text = h2.innerText.trim();

                            // Fungsi Helper: Cari Tags di Bapak atau Kakek elemen H2
                            const findTagsInAncestors = (startElement) => {
                                let currentEl = startElement;
                                // Cek sampai 3 level ke atas (Bapak -> Kakek -> Buyut)
                                for (let i = 0; i < 3; i++) {
                                    if (!currentEl.parentElement) break;
                                    currentEl = currentEl.parentElement;

                                    // Cari elemen yang class-nya mengandung "TagStyle" di dalam container ini
                                    const tags = currentEl.querySelectorAll(
                                        '[class*="TagStyle"]',
                                    );
                                    // Validasi: Pastikan tag yang ditemukan bukan tag kosong dan jumlahnya masuk akal
                                    if (tags.length > 0) {
                                        return Array.from(tags)
                                            .map((t) => t.innerText.trim()) // Ambil teks
                                            .filter((t) => t !== ""); // Hapus yang kosong
                                    }
                                }
                                return [];
                            };

                            // A. MATCHING SECTION "PERSYARATAN"
                            if (text === "Persyaratan" || text === "Requirements") {
                                data.requirements = findTagsInAncestors(h2);
                            }
                            // B. MATCHING SECTION "SKILLS"
                            else if (
                                text.startsWith("Skills") ||
                                text.startsWith("Keahlian")
                            ) {
                                data.skills = findTagsInAncestors(h2);
                            }
                            // C. MATCHING SECTION "BENEFIT"
                            else if (text.includes("Benefit") || text.includes("Tunjangan")) {
                                data.benefits = findTagsInAncestors(h2);
                            }
                        });

                        // 3. INFO PEKERJAAN (Top Fold) - Tidak berubah, sudah aman
                        const topInfos = mainContent.querySelectorAll(
                            '[class*="TopFoldExperimentsc__JobOverViewInfo"]',
                        );
                        topInfos.forEach((info) => {
                            const txt = info.innerText.trim();
                            if (txt.includes("pengalaman")) data.experienceLevel = txt;
                            else if (
                                txt.includes("Sarjana") ||
                                txt.includes("Diploma") ||
                                txt.includes("SMA") ||
                                txt.includes("SMK")
                            )
                                data.minEducation = txt;
                            else if (
                                txt.includes("Penuh Waktu") ||
                                txt.includes("Kontrak") ||
                                txt.includes("Magang")
                            )
                                data.jobType = txt;
                        });

                        const updateInfo = mainContent.querySelector(
                            '[class*="UpdatedTimestampInJobTopFold"]',
                        );
                        if (updateInfo) data.lastUpdated = updateInfo.innerText.trim();

                        // 4. INFO PERUSAHAAN - Tidak berubah, sudah aman
                        const compSection = mainContent.querySelector(
                            '[class*="AboutCompanySectionsc__Main"]',
                        );
                        if (compSection) {
                            const indSizeDiv = compSection.querySelector(
                                '[class*="AboutCompanySectionsc__CompanyIndustryAndSize"]',
                            );
                            if (indSizeDiv) {
                                const spans = indSizeDiv.querySelectorAll("span");
                                if (spans.length > 0)
                                    data.companyDetails.industry = spans[0].innerText;
                                if (spans.length > 1)
                                    data.companyDetails.size = spans[1].innerText;
                            }
                            const webAnchor = compSection.querySelector(
                                '[class*="AboutCompanySectionsc__Website"] a',
                            );
                            if (webAnchor) data.companyDetails.website = webAnchor.href;
                            const compDesc = compSection.querySelector(
                                '[class*="AboutCompanySectionsc__CompanyDesc"]',
                            );
                            if (compDesc)
                                data.companyDetails.description = compDesc.innerText.trim();

                            const allDivs = compSection.querySelectorAll("div");
                            for (let div of allDivs) {
                                if (div.innerText === "Alamat kantor") {
                                    if (div.nextElementSibling)
                                        data.companyDetails.address =
                                            div.nextElementSibling.innerText.trim();
                                    break;
                                }
                            }
                        }
                    }

                    return data;
                });

                await Job.findOneAndUpdate(
                    { externalId: job.externalId },
                    {
                        description:
                            detailData.descriptionHTML || "<p>Deskripsi tidak tersedia.</p>",
                        skills: [...new Set(detailData.skills)],
                        requirements: [...new Set(detailData.requirements)],
                        benefits: [...new Set(detailData.benefits)],
                        jobType: detailData.jobType,
                        experienceLevel: detailData.experienceLevel,
                        minEducation: detailData.minEducation,
                        lastUpdated: detailData.lastUpdated,
                        companyDetails: detailData.companyDetails,
                    },
                );
            } catch (err) {
                console.log(`   ❌ Gagal parsing: ${err.message}`);
            }

            await new Promise((r) => setTimeout(r, 1500));
        }

        console.log("\n🎉 MISSION COMPLETE! Skills & Benefits should be fixed.");
    } catch (error) {
        console.error("❌ Error Scraper:", error);
    } finally {
        await browser.close();
    }
};

module.exports = { scrapeGlints };
