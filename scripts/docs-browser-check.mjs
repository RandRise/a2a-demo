import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.DOCS_URL || 'http://127.0.0.1:5173';
const output = new URL('../.qa/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'chrome',
  headless: true,
});
const checks = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto(base);
  assert.equal(response.status(), 200);
  await page.getByRole('heading', { name: /How does one agent ask another for help/ }).waitFor();
  const walkthrough = page.getByRole('region', { name: 'Illustrated handoff walkthrough' });
  assert.equal(
    await walkthrough.getByRole('button', { name: '← Previous', exact: true }).isDisabled(),
    true,
  );
  const headings = [
    'Hand over the goal',
    'Ask what is missing',
    'Continue the same task',
    'Do the specialist’s work',
    'Return and check the result',
  ];
  for (const heading of headings) {
    await walkthrough.getByRole('button', { name: 'Next step →', exact: true }).click();
    await walkthrough.getByRole('heading', { name: heading, exact: true }).waitFor();
  }
  await walkthrough.getByRole('button', { name: 'Replay the handoff ↺', exact: true }).click();
  await walkthrough.getByRole('heading', { name: 'Find the specialist', exact: true }).waitFor();
  await walkthrough
    .getByRole('button', { name: 'Step 3: Ask what is missing', exact: true })
    .click();
  assert.equal(
    await walkthrough
      .getByRole('button', { name: 'Step 3: Ask what is missing', exact: true })
      .getAttribute('aria-current'),
    'step',
  );
  checks.push(
    'All six illustration steps, direct step selection, previous boundary, and replay work.',
  );
  const quiz = page.getByRole('region', { name: 'What makes the specialist an agent role?' });
  for (const [answer, feedback] of [
    ['It is just a calculator with a different name.', 'Look at who manages the work.'],
    ['It owns the delegated task and can choose its next action.', 'Exactly.'],
    [
      'A2A automatically makes every reply correct.',
      'A2A gives the agents a shared communication contract.',
    ],
  ]) {
    await quiz.getByRole('button', { name: answer, exact: false }).click();
    assert.ok((await quiz.getByRole('status').textContent()).includes(feedback));
  }
  checks.push('All quiz answers show their corresponding explanation.');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: fileURLToPath(new URL('docs-desktop.png', output)),
    fullPage: true,
  });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Overflow at ${width}`,
    );
  }
  await page.screenshot({
    path: fileURLToPath(new URL('docs-mobile.png', output)),
    fullPage: true,
  });
  checks.push('No horizontal overflow at 1440, 768, 390, and 320 pixels.');
  const audits = [];
  for (const [route, width] of [
    ['/', 1440],
    ['/', 390],
    ['/review.html', 1440],
    ['/review.html', 390],
  ]) {
    await page.setViewportSize({ width, height: 1050 });
    assert.equal((await page.goto(new URL(route, base).href)).status(), 200);
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    audits.push({ route, width, violations: audit.violations });
  }
  await writeFile(new URL('docs-accessibility.json', output), JSON.stringify(audits, null, 2));
  assert.deepEqual(
    audits.flatMap((audit) =>
      audit.violations.map((issue) => ({
        route: audit.route,
        width: audit.width,
        id: issue.id,
        targets: issue.nodes.map((node) => node.target),
      })),
    ),
    [],
  );
  checks.push('Four automated accessibility audits passed: explanation/review on desktop/mobile.');
  await page.locator('summary').first().click();
  assert.equal(await page.locator('details').first().getAttribute('open'), '');
  for (const route of ['/ARCHITECTURE.html', '/PRESENTATION.html', '/VALIDATION.html']) {
    assert.equal((await page.goto(new URL(route, base).href)).status(), 200);
    assert.ok(await page.locator('h1').count());
  }
  assert.deepEqual(errors, []);
  checks.push('Review answer reveal and reference pages work; no browser JavaScript exceptions.');
  await writeFile(new URL('docs-browser-checks.json', output), JSON.stringify(checks, null, 2));
  for (const check of checks) console.log(`PASS ${check}`);
} finally {
  await browser.close();
}
