const puppeteer = require("puppeteer");

class PDFService {
    constructor() {
        this.browser = null;
    }

    async initializeBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: "new",
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });
        }
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    // Helper function to format date ranges
    formatDateRange(startDate, endDate) {
        if (!startDate) return "";

        // Convert to shorter format if possible
        const formatDate = (date) => {
            if (!date) return "";
            // If it's already short (e.g., "2023-10"), keep it
            if (date.length <= 7) return date;
            // If it's a full date, extract year-month
            if (date.includes("-")) {
                const parts = date.split("-");
                return `${parts[0]}-${parts[1]}`;
            }
            return date;
        };

        const start = formatDate(startDate);
        const end = endDate ? formatDate(endDate) : "Present";

        return `${start} – ${end}`;
    }

    // Helper function to escape HTML
    escapeHtml(text) {
        if (!text) return "";
        const map = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    generateCVHTML(profile, user, style = "modern") {
        const {
            fullName,
            headline,
            email,
            phone,
            address,
            summary,
            experience,
            education,
            skills,
            certifications,
            aiSummary,
            linkedin,
            github,
            portfolio,
        } = profile;

        return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${fullName || "CV"}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            @page {
                size: A4;
                margin: 1.5cm 1cm;
            }
            
            body {
                font-family: 'Times New Roman', Times, serif;
                font-size: 10pt;
                line-height: 1.3;
                color: #000;
                background: white;
            }
            
            .cv-container {
                max-width: 21cm;
                margin: 0 auto;
                background: white;
                padding: 15px 20px;
            }
            
            .header {
                text-align: center;
                border-bottom: 2px solid #000;
                padding-bottom: 8px;
                margin-bottom: 12px;
            }
            
            .name {
                font-size: 18pt;
                font-weight: bold;
                color: #000;
                margin-bottom: 2px;
                letter-spacing: 0.5px;
            }
            
            .headline {
                font-size: 14pt;
                font-style: italic;
                margin-bottom: 6px;
                color: #333;
            }
            
            .contact-info {
                font-size: 10pt;
                line-height: 1.4;
                color: #444;
            }
            
            .section {
                margin-bottom: 12px;
                page-break-inside: avoid;
            }
            
            .section-title {
                font-size: 11pt;
                font-weight: bold;
                text-transform: uppercase;
                border-bottom: 1.5px solid #000;
                padding-bottom: 2px;
                margin-bottom: 6px;
                letter-spacing: 0.5px;
            }
            
            .summary-text {
                text-align: justify;
                line-height: 1.35;
                margin-bottom: 10px;
                font-size: 10pt;
            }
            
            .experience-item, .education-item, .cert-item {
                margin-bottom: 10px;
                page-break-inside: avoid;
            }
            
            .item-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 2px;
            }
            
            .item-title {
                font-weight: bold;
                font-style: italic;
                font-size: 10pt;
            }
            
            .item-company {
                font-weight: bold;
                font-size: 10pt;
            }
            
            .item-date {
                font-style: italic;
                text-align: right;
                font-size: 9pt;
                white-space: nowrap;
                color: #555;
            }
            
            .item-description {
                margin-top: 3px;
                padding-left: 18px;
                margin-bottom: 5px;
            }
            
            .item-description li {
                margin-bottom: 2px;
                text-align: justify;
                line-height: 1.3;
                font-size: 9.5pt;
            }
            
            .skills-list {
                line-height: 1.4;
                font-size: 10pt;
            }

            .cert-details {
                font-style: italic;
                font-size: 9pt;
                color: #555;
            }
            
            a {
                color: #000;
                text-decoration: underline;
            }
            
            /* Prevent orphan headers */
            .section-title {
                page-break-after: avoid;
            }
            
            /* Ensure items stay together */
            .experience-item,
            .education-item,
            .cert-item {
                page-break-inside: avoid;
            }
            
            /* Allow page breaks between items when needed */
            .experience-item::after,
            .education-item::after,
            .cert-item::after {
                content: "";
                display: block;
                page-break-after: auto;
            }
            
            @media print {
                body {
                    margin: 0;
                    padding: 0;
                }
                
                .cv-container {
                    padding: 0;
                }
                
                /* Force page breaks when needed */
                .page-break {
                    page-break-before: always;
                }
            }
        </style>
    </head>
    <body>
        <div class="cv-container">
            <!-- Header -->
            <div class="header">
                <div class="name">${this.escapeHtml(fullName || user?.name || "Full Name")}</div>
                ${headline ? `<div class="headline">${this.escapeHtml(headline)}</div>` : ""}
                <div class="contact-info">
                    ${address ? `${this.escapeHtml(address)} | ` : ""}
                    ${email || user?.email ? `${email || user?.email}` : ""} ${phone ? ` | ${phone}` : ""}
                    ${linkedin || github || portfolio ? "<br/>" : ""}
                    ${linkedin ? `<a href="${linkedin}">LinkedIn</a>` : ""}
                    ${linkedin && github ? " | " : ""}
                    ${github ? `<a href="${github}">GitHub</a>` : ""}
                    ${(linkedin || github) && portfolio ? " | " : ""}
                    ${portfolio ? `<a href="${portfolio}">Portfolio</a>` : ""}
                </div>
            </div>

            <!-- Summary -->
            ${aiSummary
                ? `
            <div class="section">
                <div class="section-title">SUMMARY</div>
                <div class="summary-text">${this.escapeHtml(aiSummary || summary)}</div>
            </div>
            `
                : ""
            }

            <!-- Education -->
            ${education && education.length > 0
                ? `
            <div class="section">
                <div class="section-title">EDUCATION</div>
                ${education
                    .map(
                        (edu) => `
                    <div class="education-item">
                        <div class="item-header">
                            <div style="flex: 1;">
                                <div class="item-company">${this.escapeHtml(edu.institution || "")}</div>
                                <div class="item-title">${this.escapeHtml(edu.degree || "")}${edu.field ? ` in ${this.escapeHtml(edu.field)}` : ""}</div>
                            </div>
                            <div class="item-date" style="margin-left: 10px;">
                                ${edu.graduationYear || ""}
                            </div>
                        </div>
                        ${edu.grade ? `<div style="font-size: 9pt; color: #555;">GPA / Score : ${edu.grade}</div>` : ""}
                    </div>
                `,
                    )
                    .join("")}
            </div>
            `
                : ""
            }

            <!-- Work Experience -->
            ${experience && experience.length > 0
                ? `
            <div class="section">
                <div class="section-title">WORK EXPERIENCE</div>
                ${experience
                    .map(
                        (exp) => `
                    <div class="experience-item">
                        <div class="item-header">
                            <div style="flex: 1;">
                                <div class="item-company">${exp.company || ""}</div>
                            </div>
                            <div class="item-date" style="margin-left: 10px;">
                                ${this.formatDateRange(exp.startDate, exp.endDate)}
                            </div>
                        </div>
                        <div class="item-title">${exp.position || ""}</div>
                        ${exp.description && exp.description.length > 0
                                ? `
                        <ul class="item-description">
                            ${exp.description
                                    .filter((d) => d && d.trim())
                                    .map(
                                        (desc) => `<li>${this.escapeHtml(desc)}</li>`,
                                    )
                                    .join("")}
                        </ul>
                        `
                                : ""
                            }
                    </div>
                `,
                    )
                    .join("")}
            </div>
            `
                : ""
            }

            <!-- Skills -->
            ${skills && skills.length > 0
                ? `
            <div class="section">
                <div class="section-title">SKILLS</div>
                <div class="skills-list">
                    ${skills
                    .filter((s) => s.name && s.name.trim())
                    .map((s) => this.escapeHtml(s.name))
                    .join(" • ")}
                </div>
            </div>
            `
                : ""
            }

            <!-- Certifications -->
            ${certifications && certifications.length > 0
                ? `
            <div class="section">
                <div class="section-title">CERTIFICATIONS</div>
                ${certifications
                    .map(
                        (cert) => `
                    <div class="cert-item">
                        <div style="font-weight: bold; font-size: 10pt;">${this.escapeHtml(cert.name || "")}</div>
                        ${cert.issuer || cert.year
                                ? `
                        <div class="cert-details">
                            ${cert.issuer ? this.escapeHtml(cert.issuer) : ""}
                            ${cert.issuer && cert.year ? " | " : ""}
                            ${cert.year || ""}
                        </div>
                        `
                                : ""
                            }
                    </div>
                `,
                    )
                    .join("")}
            </div>
            `
                : ""
            }
        </div>
    </body>
    </html>
    `;
    }

    async generatePDF(profile, user, options = {}) {
        try {
            await this.initializeBrowser();

            const page = await this.browser.newPage();

            // Set viewport for A4 size with proper scaling
            await page.setViewport({
                width: 794,
                height: 1123,
                deviceScaleFactor: 1.5,
            });

            const htmlContent = this.generateCVHTML(profile, user, options.style);
            await page.setContent(htmlContent, { waitUntil: "networkidle0" });

            const pdfOptions = {
                format: "A4",
                printBackground: true,
                preferCSSPageSize: false,
                displayHeaderFooter: false,
                margin: {
                    top: "1.5cm",
                    right: "1cm",
                    bottom: "1.5cm",
                    left: "1cm",
                },
                ...options.pdfOptions,
            };

            const pdfBuffer = await page.pdf(pdfOptions);
            await page.close();

            return pdfBuffer;
        } catch (error) {
            console.error("PDF Generation Error:", error);
            throw new Error("Failed to generate PDF");
        }
    }

    async generatePreviewHTML(profile, user, style = "modern") {
        try {
            return this.generateCVHTML(profile, user, style);
        } catch (error) {
            console.error("HTML Preview Generation Error:", error);
            throw new Error("Failed to generate HTML preview");
        }
    }
}

module.exports = new PDFService();
