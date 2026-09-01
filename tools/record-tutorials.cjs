const { chromium } = require("playwright");
const fs = require("fs/promises");
const path = require("path");

const baseUrl = "http://127.0.0.1:8080";
const outputDir = path.resolve("src/main/resources/static/smartapartment/tutorials");
const viewport = { width: 1280, height: 720 };

async function pause(page, milliseconds = 1600) {
    await page.waitForTimeout(milliseconds);
}

async function addCaption(page, eyebrow, title, detail) {
    await page.evaluate(({ eyebrow, title, detail }) => {
        document.getElementById("recordingCaption")?.remove();
        const caption = document.createElement("aside");
        caption.id = "recordingCaption";
        caption.innerHTML = `<small>${eyebrow}</small><strong>${title}</strong><span>${detail}</span>`;
        caption.style.cssText = "position:fixed;z-index:2147483647;left:34px;bottom:32px;width:min(520px,calc(100vw - 68px));padding:18px 21px;border:1px solid rgba(255,255,255,.24);border-radius:10px;color:#fff;background:linear-gradient(135deg,rgba(8,18,48,.96),rgba(35,70,170,.94));box-shadow:0 22px 55px rgba(2,8,23,.38);font-family:Inter,Arial,sans-serif;display:grid;gap:5px;opacity:0;transform:translateY(16px);transition:.35s ease";
        caption.querySelector("small").style.cssText = "font-size:10px;font-weight:850;letter-spacing:.16em;color:#9db7ff";
        caption.querySelector("strong").style.cssText = "font-size:20px;line-height:1.2";
        caption.querySelector("span").style.cssText = "font-size:12px;line-height:1.55;color:rgba(255,255,255,.76)";
        document.body.appendChild(caption);
        requestAnimationFrame(() => { caption.style.opacity = "1"; caption.style.transform = "none"; });
    }, { eyebrow, title, detail });
    await pause(page, 2100);
}

async function removeCaption(page) {
    await page.evaluate(() => {
        const caption = document.getElementById("recordingCaption");
        if (!caption) return;
        caption.style.opacity = "0";
        caption.style.transform = "translateY(12px)";
    });
    await pause(page, 500);
}

async function login(page, role, email, password) {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.evaluate(async ({ role, email, password }) => {
        const response = await fetch("/api/auth/dashboard-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: "smartapartment", role, username: email, password })
        });
        if (!response.ok) throw new Error("Tutorial login failed");
    }, { role, email, password });
}

async function record(name, scene) {
    const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
    const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
        recordVideo: { dir: outputDir, size: viewport },
        reducedMotion: "no-preference"
    });
    const tutorialAccount = name === "operations-guide"
        ? { role: "security", username: "security@smartapartment", password: "security123" }
        : name === "finance-guide"
            ? { role: "admin", username: "admin@smartapartment", password: "admin123" }
            : null;
    if (tutorialAccount) {
        const response = await context.request.post(`${baseUrl}/api/auth/dashboard-login`, {
            data: { platform: "smartapartment", ...tutorialAccount }
        });
        if (!response.ok()) throw new Error(`Tutorial authentication failed: ${response.status()}`);
    }
    const page = await context.newPage();
    try {
        await scene(page);
        const video = page.video();
        await context.close();
        const generated = await video.path();
        const finalPath = path.join(outputDir, `${name}.webm`);
        await fs.rm(finalPath, { force: true });
        await fs.rename(generated, finalPath);
        console.log(`${name}: ${finalPath}`);
    } finally {
        await Promise.race([
            browser.close(),
            new Promise(resolve => setTimeout(resolve, 3000))
        ]);
    }
}

async function onboarding(page) {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await addCaption(page, "SMARTAPARTMENT ACADEMY · ONBOARDING", "Create a secure society workspace", "Start from the landing page and choose the workspace setup designed for your community.");
    await removeCaption(page);
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await pause(page, 900);
    await addCaption(page, "STEP 1 · WORKSPACE BASICS", "Enter the administrator and society details", "Required fields are validated before the secure setup can continue.");
    await removeCaption(page);
    await page.locator("#landingDemoForm input[name='name']").fill("Kavya Sharma");
    await page.locator("#landingDemoForm input[name='phone']").fill("9876543210");
    await page.locator("#landingDemoForm input[name='email']").fill("kavya@example.com");
    await page.locator("#landingDemoForm select[name='city']").selectOption({ label: "Chennai" });
    await pause(page, 900);
    await page.evaluate(() => {
        document.getElementById("registerModal")?.classList.remove("hidden");
        document.body.classList.add("modal-open");
    });
    await pause(page, 900);
    await addCaption(page, "STEP 2 · SECURE REVIEW", "Complete the society profile", "Confirm registered identity, units, address, administrator role and plan before approval.");
    await removeCaption(page);
    await page.evaluate(() => {
        document.getElementById("registerModal")?.classList.add("hidden");
        document.body.classList.remove("modal-open");
    });
    await pause(page, 700);
}

async function operations(page) {
    await page.goto(`${baseUrl}/dashboards/security#overview`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await addCaption(page, "SMARTAPARTMENT ACADEMY · OPERATIONS", "Gate operations at a glance", "Security staff can review expected visitors, live entries and operational alerts in one workspace.");
    await removeCaption(page);
    const pass = page.locator('[data-panel="verify"]').first();
    if (await pass.count()) await pass.click();
    await pause(page, 900);
    await addCaption(page, "STEP 1 · VERIFY", "Validate the visitor pass", "Confirm visitor identity, destination flat, purpose and QR status before entry.");
    await removeCaption(page);
    const entries = page.locator('[data-panel="entries"]').first();
    if (await entries.count()) await entries.click();
    await pause(page, 900);
    await addCaption(page, "STEP 2 · RECORD", "Maintain an auditable gate log", "Every check-in and checkout is timestamped and visible to authorized teams.");
    await removeCaption(page);
}

async function finance(page) {
    await page.goto(`${baseUrl}/dashboards/society-admin#overview`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await addCaption(page, "SMARTAPARTMENT ACADEMY · FINANCE", "Manage society finances with clarity", "Review billing, collections, expenses and payment status from the administrator workspace.");
    await removeCaption(page);
    const billing = page.locator('[data-panel="billing"]').first();
    if (await billing.count()) await billing.click();
    await pause(page, 1000);
    await addCaption(page, "STEP 1 · BILLING", "Generate and review maintenance invoices", "Recurring rules create consistent monthly dues with transparent status tracking.");
    await removeCaption(page);
    const payments = page.locator('[data-panel="payments"]').first();
    if (await payments.count()) await payments.click();
    await pause(page, 900);
    await addCaption(page, "STEP 2 · COLLECTIONS", "Reconcile payments and receipts", "Track submitted payments, approvals and resident receipts in the same tenant-isolated ledger.");
    await removeCaption(page);
}

(async () => {
    await fs.mkdir(outputDir, { recursive: true });
    const requested = process.argv[2] || "all";
    const scenes = { onboarding: ["onboarding-guide", onboarding], operations: ["operations-guide", operations], finance: ["finance-guide", finance] };
    if (requested === "all") {
        for (const [name, scene] of Object.values(scenes)) await record(name, scene);
    } else if (scenes[requested]) {
        await record(...scenes[requested]);
    } else {
        throw new Error(`Unknown tutorial: ${requested}`);
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
