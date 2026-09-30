/** Requires the fixture server (serve-worlds.cjs) and Playwright.
 * PLAYWRIGHT_MODULE / CHROMIUM_EXECUTABLE can point at a bundled local runtime. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(process.env.VISUAL_OUTPUT || 'docs/ui-shell/worlds-evidence');
fs.mkdirSync(out, {recursive:true});
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_EXECUTABLE || undefined, args:['--no-sandbox']});
  const report = {timestamp:new Date().toISOString(), environment:'Chromium / production React App / inert IPC fixture', checks:[], errors:[]};
  const page = await browser.newPage();
  page.on('pageerror', e => report.errors.push(e.stack));
  const base = 'http://127.0.0.1:5199/test/visual/worlds.html';
  async function capture(name) { await page.screenshot({path:path.join(out, name+'.png')}); }
  async function layout(label) {
    const bounds = await page.evaluate(() => {
      const box = s => {const el=document.querySelector(s); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,scroll:el.scrollWidth,client:el.clientWidth};};
      return {viewport:innerWidth,body:document.documentElement.scrollWidth,stage:box('.worlds-stage'),sidebar:box('.worlds-sidebar'),roster:box('.worlds-roster'),header:box('.worlds-titlebar')};
    });
    assert(bounds.body <= bounds.viewport, label+' document overflow');
    assert(bounds.stage.right <= bounds.sidebar.x || bounds.sidebar.right <= bounds.stage.x, label+' scene overlaps sidebar');
    assert(bounds.sidebar.right <= bounds.viewport, label+' sidebar outside viewport');
    assert(bounds.stage.bottom <= bounds.roster.y+1, label+' scene overlaps roster');
    assert(bounds.roster.right <= bounds.sidebar.x || bounds.sidebar.right <= bounds.roster.x, label+' roster overlaps ledger');
    assert(bounds.header.scroll <= bounds.header.client+1, label+' header overflow');
    report.checks.push({label,...bounds});
  }
  try {
    for (const width of [1440,1024,860]) {
      await page.setViewportSize({width,height:900});
      await page.goto(base);
      await page.locator('.worlds-command').waitFor();
      await page.locator('[data-world-active="true"] canvas').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await layout('world-'+width); await capture('world-'+width);
      const canvas = await page.locator('[data-world-active="true"] canvas').elementHandle();
      await page.getByRole('button',{name:'Marketplace',exact:true}).click();
      await page.locator('.worlds-market-counter').waitFor();
      await capture('marketplace-'+width);
      assert(await page.locator('.worlds-marketplace input[type=search]').isDisabled());
      await page.getByRole('button',{name:'Mundo',exact:true}).click();
      assert(await canvas.evaluate(el => el.isConnected), 'marketplace must retain world');
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('cth:open-settings')));
      await page.locator('.worlds-settings-page').waitFor();
      await capture('settings-'+width);
      const pageBounds = await page.locator('.worlds-settings-book').boundingBox();
      assert(pageBounds.x >= 0 && pageBounds.x+pageBounds.width <= width);
      await page.goto(base+'?view=entry');
      await page.locator('.worlds-entry .worlds-brand').waitFor(); await capture('entry-'+width);
      await page.goto(base+'?view=onboarding');
      await page.locator('.worlds-entry .worlds-brand').waitFor(); await capture('onboarding-'+width);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'onboarding horizontal overflow');
    }
    // Repeated live resize exercises the actual Pixi canvas lifecycle.
    await page.goto(base); await page.locator('.worlds-command').waitFor();
    await page.locator('[data-world-active="true"] canvas').waitFor();
    const retainedCanvas = await page.locator('[data-world-active="true"] canvas').elementHandle();
    for (const width of [1440,860,1024,1440,860]) { await page.setViewportSize({width,height:900}); await page.waitForTimeout(350); await layout('resize-'+width); assert(await retainedCanvas.evaluate(el => el.isConnected), 'resize must retain Pixi canvas'); }
    // Each existing command section must remain reachable at the narrow size.
    const tabs = await page.locator('.worlds-command .cth-tabbar button').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')));
    for (const name of tabs) {
      await page.locator('.worlds-command .cth-tabbar').getByRole('button',{name:name.trim(),exact:true}).click();
      await page.waitForTimeout(250); await layout('tab-'+name.trim());
      const overflow = await page.locator('.worlds-book-page').evaluate(el => ({client:el.clientWidth,scroll:el.scrollWidth}));
      assert(overflow.scroll <= overflow.client+1, name+' page overflow');
      if (name.trim() === 'Monitor') {
        const escaped = await page.locator('.worlds-monitor-agent-header').evaluateAll(rows => rows.flatMap(row => {
          const r = row.getBoundingClientRect();
          return [...row.children].filter(child => { const c = child.getBoundingClientRect(); return c.left < r.left-1 || c.right > r.right+1; }).map(child => child.textContent);
        }));
        assert.deepEqual(escaped, [], 'monitor header must wrap all controls within the page');
      }
      if (['Monitor','Habilidades','Trabajadores'].includes(name.trim())) await capture('section-'+name.trim());
    }
    for (const lang of ['en','es','ja','zh-CN','ar']) {
      await page.goto(base+'?lang='+lang); await page.locator('.worlds-command').waitFor(); await layout('locale-'+lang);
    }
    for (const width of [1440,860]) {
      await page.setViewportSize({width,height:900});
      await page.goto(base+'?theme=dark'); await page.locator('.worlds-command').waitFor();
      await page.locator('[data-world-active="true"] canvas').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await layout('dark-'+width); assert.equal(await page.locator('html').getAttribute('data-cth-theme'), 'dark'); await capture('world-dark-'+width);
    }
    assert.equal(report.errors.length,0,'Browser errors: '+report.errors.join('\n'));
    report.result = 'PASS';
  } catch (error) { report.result='FAIL'; report.failure=error.stack; process.exitCode=1; }
  finally { fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({result:report.result,checks:report.checks.length,errors:report.errors,failure:report.failure},null,2));await browser.close(); }
})();
