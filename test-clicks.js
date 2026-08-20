const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log("Navigating...");
  await page.goto('http://localhost:8080/superadmin', { waitUntil: 'networkidle0' });
  
  console.log("Looking for overview button...");
  const button = await page.$('button[data-panel="overview"]');
  if (button) {
    console.log("Clicking overview button...");
    await button.click();
    console.log("Clicked.");
    // wait a bit
    await new Promise(r => setTimeout(r, 1000));
  } else {
    console.log("Button not found.");
  }
  
  const auditLogsButton = await page.$('button[data-panel="audit-logs"]');
  if (auditLogsButton) {
      console.log("Clicking audit logs...");
      await auditLogsButton.click();
      console.log("Clicked.");
      await new Promise(r => setTimeout(r, 1000));
      const isVisible = await page.$eval('[data-view="audit-logs"]', el => !el.classList.contains('d-none'));
      console.log("Is audit-logs visible? " + isVisible);
  }

  await browser.close();
})();
