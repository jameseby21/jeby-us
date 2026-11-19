// Render master.html to the official files: vector PDF (100 mm square page) and PNGs at 4096, 2048, 1000 and 512 px.
const {chromium} = require('playwright'); const fs = require('fs');
(async () => {
  const out = __dirname + '/out-master'; fs.mkdirSync(out, {recursive: true});
  const b = await chromium.launch(); const side = 650;
  const p = await b.newPage({viewport: {width: side, height: side}});
  await p.goto('file://' + __dirname + '/master.html'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  console.log('wordmark font loaded:', await p.evaluate(() => document.fonts.check('700 40px IS')));
  // 650 CSS px = 171.979 mm; scale so the PDF page is exactly 100 mm square
  await p.pdf({path: out + '/master.pdf', width: '100mm', height: '100mm', scale: 100 / 171.979, printBackground: true, pageRanges: '1',
               margin: {top: '0', right: '0', bottom: '0', left: '0'}});
  for (const px of [4096, 2048, 1000, 512]) {
    const q = await b.newPage({viewport: {width: side, height: side}, deviceScaleFactor: px / side});
    await q.goto('file://' + __dirname + '/master.html'); await q.evaluate(() => document.fonts.ready); await q.waitForTimeout(400);
    await q.screenshot({path: `${out}/master-${px}.png`, clip: {x: 0, y: 0, width: side, height: side}});
    await q.close();
  }
  await b.close();
})();
