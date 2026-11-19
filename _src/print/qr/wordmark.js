// Render the jeby wordmark exactly as jeby.us sets it (.wordmark CSS from _src/jeby/src/site.css), transparent PNG.
const {chromium} = require('playwright');
const VARIANTS = [['wordmark.html', 'wordmark.png'], ['wordmark-us.html', 'wordmark-us.png']];
(async () => { require('fs').mkdirSync(__dirname + '/build', {recursive: true}); const b = await chromium.launch(); const p = await b.newPage({deviceScaleFactor: 1});
  for (const [html, png] of VARIANTS) {
  await p.goto('file://' + __dirname + '/' + html);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
  await (await p.$('#w')).screenshot({path: __dirname + '/build/' + png, omitBackground: true}); } await b.close(); })();
