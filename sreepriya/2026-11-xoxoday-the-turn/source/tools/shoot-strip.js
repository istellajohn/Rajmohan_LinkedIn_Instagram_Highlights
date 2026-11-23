// Render a horizontal strip of 1080x1350 slides by clipping one wide page.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [html, outDir, prefix, n] = process.argv.slice(2);
  const count = Number(n);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080 * count, height: 1350 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(html));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  for (let i = 0; i < count; i++) {
    await page.screenshot({ path: path.join(outDir, `${prefix}-${String(i + 1).padStart(2, '0')}.png`),
      clip: { x: i * 1080, y: 0, width: 1080, height: 1350 } });
  }
  await page.screenshot({ path: path.join(outDir, `${prefix}-panorama.png`), fullPage: false });
  await browser.close();
  console.log('shot', count);
})();
