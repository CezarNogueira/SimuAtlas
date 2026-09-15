// Teste de ponta a ponta com Chrome real: percorre menu, novo jogo, mapa, simulacao acelerada,
// paineis, modais, salvamento e carregamento; salva screenshots e reporta erros do console.
// Uso: node scripts/e2e.mjs [pastaSaida] [mapa] (servidor Vite rodando em http://127.0.0.1:5173)
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const OUT = process.argv[2] ?? 'scripts/out';
const MAP = process.argv[3] ?? 'europe';
const URL = process.env.URL ?? 'http://127.0.0.1:5173/';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FAST_SECONDS = Number(process.env.FAST ?? 15);

mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const log = (msg) => console.log(`[e2e] ${msg}`);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--window-size=1600,900', '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  defaultViewport: { width: 1600, height: 900 },
});

try {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warn') errors.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`));
  page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
  page.on('dialog', (d) => void d.accept());

  const shot = async (name) => {
    await page.screenshot({ path: `${OUT}/${name}.png` });
    log(`screenshot ${name}`);
  };
  const clickIf = async (selector) => {
    const el = await page.$(selector);
    if (!el) {
      log(`não encontrado: ${selector}`);
      return false;
    }
    await el.click();
    return true;
  };

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector('[data-act="new"]', { timeout: 60000 });
  await sleep(400);
  await shot('01-menu');

  await page.click('[data-act="new"]');
  await page.waitForSelector(`[data-map="${MAP}"]`, { timeout: 20000 });
  await page.click(`[data-map="${MAP}"]`);
  await sleep(500);
  await shot('02-newgame');

  const t0 = Date.now();
  await page.click('[data-act="start"]');
  await page.waitForSelector('canvas[data-ui="map"]', { timeout: 120000 });
  log(`jogo carregado em ${Date.now() - t0} ms`);
  await sleep(2500);
  await shot('03-game-start');

  await page.keyboard.press('7');
  await sleep(FAST_SECONDS * 1000);
  const hud = await page.evaluate(() => ({
    date: document.querySelector('[data-part="date"]')?.textContent,
    speed: document.querySelector('[data-real]')?.textContent,
    wars: document.querySelector('[data-part="wars"]')?.textContent,
    nations: document.querySelector('[data-part="nations"]')?.textContent,
  }));
  log(`após ${FAST_SECONDS}s a 100x: ${JSON.stringify(hud)}`);
  await shot('04-after-fast');

  await page.keyboard.press('Space');
  await page.mouse.click(820, 470);
  await sleep(1200);
  if (!(await page.$('[data-tab="territorio"]'))) {
    // O clique caiu no mar: seleciona a maior nacao pelo ranking das estatisticas.
    log('clique no mapa sem nação; usando o ranking');
    await page.keyboard.press('e');
    await page.waitForSelector('[data-ui="rank-card"] li[data-country]', { visible: true, timeout: 5000 });
    await sleep(400);
    await page.click('[data-ui="rank-card"] li[data-country]');
    await sleep(300);
    await page.keyboard.press('Escape');
    await sleep(900);
  }
  await shot('05-nation-panel');
  if (await clickIf('[data-tab="territorio"]')) {
    await sleep(700);
    await shot('06-tab-territorio');
  }
  if (await clickIf('[data-tab="tecnologia"]')) {
    await sleep(700);
    await shot('06b-tab-tecnologia');
  }
  await page.keyboard.press('Escape');

  await page.mouse.move(800, 450);
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel({ deltaY: -200 });
    await sleep(150);
  }
  await page.keyboard.press('Space');
  await page.keyboard.press('4');
  await sleep(4000);
  await shot('07-zoom-running');
  await page.keyboard.press('Space');

  // Lista de guerras e painel de uma guerra (regras de fim da guerra).
  await page.keyboard.press('g');
  await sleep(800);
  if (await clickIf('[data-panel="left"] [data-war]')) {
    await sleep(1000);
    await shot('07b-war-panel');
    await page.keyboard.press('Escape');
  }
  await page.keyboard.press('g');
  await sleep(300);

  // Painel de tecnologias, detalhe de uma tecnologia e sua trajetoria.
  await page.keyboard.press('t');
  await sleep(900);
  await shot('07c-tech-list');
  if (await clickIf('[data-panel="left"] [data-tech]')) {
    await sleep(1000);
    await shot('07d-tech-panel');
    if (await clickIf('[data-panel="right"] [data-tab="historico"]')) {
      await sleep(600);
      await shot('07e-tech-history');
    }
    await page.keyboard.press('Escape');
  }
  await page.keyboard.press('t');
  await sleep(300);

  await page.keyboard.press('e');
  await sleep(800);
  if (await clickIf('[data-tab="evolucao"]')) {
    await sleep(1200);
    await shot('08-evolution');
  }
  await page.keyboard.press('Escape');

  await clickIf('[data-ui="bottombar"] [data-act="save"]');
  await page.waitForSelector('[data-action="save-new"]', { visible: true, timeout: 5000 });
  await sleep(500);
  await page.click('[data-action="save-new"]');
  await sleep(2500);
  const rows = await page.$$eval('[data-ui="save-row"]', (els) => els.length);
  log(`saves listados após salvar: ${rows}`);
  await shot('09-saved');
  await page.keyboard.press('Escape');

  await clickIf('[data-ui="bottombar"] [data-act="load"]');
  await sleep(1500);
  await shot('10-load');
  if (await clickIf('[data-load]')) {
    await page.waitForSelector('canvas[data-ui="map"]', { timeout: 60000 });
    await sleep(2500);
    const date = await page.evaluate(() => document.querySelector('[data-part="date"]')?.textContent);
    log(`jogo recarregado na data ${date}`);
    await shot('11-loaded');
  }
} catch (err) {
  errors.push(`[e2e] ${err.stack ?? err}`);
} finally {
  await browser.close();
}

if (errors.length) {
  console.log(`\n${errors.length} erro(s)/aviso(s):`);
  for (const e of errors.slice(0, 40)) console.log(e);
} else {
  console.log('\nNenhum erro no console.');
}
