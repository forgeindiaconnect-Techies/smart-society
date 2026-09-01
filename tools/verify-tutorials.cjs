const { chromium } = require("playwright");

(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://127.0.0.1:8080/#tutorials", { waitUntil: "domcontentloaded" });
    await page.locator("#tutorials").scrollIntoViewIfNeeded();
    const results = [];
    for (const name of ["onboarding", "operations", "finance"]) {
        await page.locator(`[data-tutorial="${name}"]`).click();
        const video = page.locator("#tutorialVideo");
        await video.waitFor({ state: "visible" });
        const source = await video.getAttribute("src");
        const response = await page.request.get(new URL(source, page.url()).href);
        results.push({ name, source, status: response.status(), bytes: (await response.body()).length });
        if (name === "operations") await page.screenshot({ path: "target/tutorial-player-verification.png", fullPage: false });
        await page.locator("#closeTutorialPlayer").click();
    }
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
