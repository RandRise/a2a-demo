import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { startDemo } from '../src/app.mjs';

const output = new URL('../.qa/', import.meta.url);
await mkdir(output, { recursive: true });
const demo = await startDemo({ port: 0, agentPort: 0 });
let browser;
const checks = [];
const audits = [];
try {
  browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || 'chrome',
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  async function screenshot(name) {
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({ path: fileURLToPath(new URL(name, output)), fullPage: true });
  }
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(demo.url);
  await page.getByRole('heading', { name: 'Delegation, made visible.' }).waitFor();
  await screenshot('desktop-ready.png');
  async function audit(label) {
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    audits.push({ label, violations: accessibility.violations });
    await writeFile(new URL('accessibility.json', output), JSON.stringify(audits, null, 2));
    assert.deepEqual(
      accessibility.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => node.target),
      })),
      [],
      `Accessibility violations: ${label}`,
    );
  }
  await audit('Desktop ready');
  checks.push('Desktop page: no WCAG A/AA automated violations');
  await page.getByRole('button', { name: 'Start the handoff' }).click();
  await page.locator('#clarification-form').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#run-state').textContent(), 'Needs your input');
  const pendingTaskIds = await page.locator('#task-identifiers').textContent();
  await page.reload();
  await page.locator('#clarification-form').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#task-identifiers').textContent(), pendingTaskIds);
  checks.push('Browser refresh restores the pending task without browser storage');
  await audit('Clarification');
  await screenshot('desktop-clarification.png');
  await page.getByRole('button', { name: 'Send answer' }).click();
  await page.locator('#result').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#result-heading').textContent(), 'Harbor Hall');
  assert.match(await page.locator('.budget-verdict').textContent(), /150/);
  assert.equal(await page.locator('.comparison-option').count(), 3);
  await audit('Completed recommendation');
  checks.push('Browser → coordinator → real A2A → clarification → same-task completion');
  await screenshot('desktop-completed.png');
  await page.getByRole('tab', { name: /Protocol inspector/ }).click();
  await page.locator('.trace-item summary').first().click();
  assert.match(await page.locator('.trace-item').first().textContent(), /Venue specialist/);
  assert.match(await page.locator('#task-identifiers').textContent(), /completed/);
  checks.push('Protocol inspector shows actual Agent Card and completed task identifiers');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download result/ }).click();
  assert.equal((await download).suggestedFilename(), 'relay-venue-recommendation.json');
  checks.push('Recommendation download');
  await page.getByRole('button', { name: /New run/ }).click();
  await page.getByRole('button', { name: /A budget that cannot work/ }).click();
  await page.getByRole('button', { name: 'Start the handoff' }).click();
  await page.getByText('No suitable venue', { exact: true }).waitFor();
  assert.equal(await page.locator('#result').isVisible(), false);
  checks.push('Impossible budget renders an honest rejection with no artifact');
  await page.getByRole('button', { name: /How it works/ }).click();
  await page.getByRole('heading', { name: 'Operations vs. responsibility.' }).waitFor();
  await audit('Explanation');
  await screenshot('desktop-guide.png');
  await page.getByRole('button', { name: /Venue catalogue/ }).click();
  assert.equal(await page.locator('.venue-card').count(), 6);
  await audit('Catalogue');
  checks.push('Guide and all six catalogue entries');
  await page.getByRole('button', { name: /Model connection/ }).click();
  await page.getByRole('dialog').waitFor();
  await audit('Connection dialog');
  await page.getByLabel('API key').fill('invented-test-marker-not-a-real-key');
  await page.getByRole('button', { name: 'Close connection settings' }).click();
  assert.equal(await page.getByLabel('API key').inputValue(), '');
  checks.push('Key field clears when connection dialog closes');
  await page.getByRole('button', { name: /Run a handoff/ }).click();
  await page.getByRole('button', { name: /New run/ }).click();
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
        .map((element) => ({
          tag: element.tagName,
          class: element.className,
          right: element.getBoundingClientRect().right,
        })),
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      `Horizontal overflow at ${width}px: ${JSON.stringify(overflow)}`,
    );
    if (width === 390) {
      await audit('Mobile ready');
      await screenshot('mobile-ready.png');
    }
  }
  checks.push('No horizontal overflow at 1024, 768, 390, and 320 pixels');
  assert.deepEqual(errors, []);
  checks.push('No browser JavaScript exceptions');
  await writeFile(
    new URL('browser-checks.json', output),
    JSON.stringify(
      { checks, browser: browser.version(), testedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log(checks.map((check) => `PASS ${check}`).join('\n'));
} finally {
  await browser?.close();
  await demo.close();
}
