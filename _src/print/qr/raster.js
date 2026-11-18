// Rasterise Drew's engraving (static, tongue at rest) and a tongue-only mask, 2000 px wide.
const {chromium} = require('playwright'); const fs = require('fs');
(async () => {
  const svg = fs.readFileSync(__dirname + '/../../jeby/static/drew-tongue.svg', 'utf8').replace(/width="512" height="504"/, 'width="2000" height="1970"');
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:2000,height:1970}});
  for (const [name, css] of [['drew', ''], ['tongue', 'path:not(.tongue *):not(.tongue){fill:#fff!important}.tongue path{fill:#000!important}']]) {
    await p.setContent(`<html><body style="margin:0;background:#fff"><style>*{animation:none!important}${css}</style>${svg}</body></html>`);
    fs.mkdirSync(__dirname + '/build', {recursive: true});
    await p.screenshot({path:`${__dirname}/build/${name}-2000.png`, clip:{x:0,y:0,width:2000,height:1970}});
  }
  await b.close();
})();
