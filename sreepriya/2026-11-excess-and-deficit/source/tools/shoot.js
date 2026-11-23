// Render each .slide to a 1080x1350 PNG (and a contact sheet).
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [html, outDir, scale] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: Number(scale || 1) });
  await page.goto('file://' + path.resolve(html));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const slides = await page.$$('section.slide');
  for (let i = 0; i < slides.length; i++) {
    const f = path.join(outDir, `sreepriya-excess-deficit-${String(i + 1).padStart(2, '0')}.png`);
    await slides[i].screenshot({ path: f });
  }
  await browser.close();
  console.log('shot', slides.length);
})();
