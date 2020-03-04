// usage: npx ts-node index.ts

import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 10,
  });
  const page = await browser.newPage();
  await page.goto('https://accounts.pixiv.net/login');
  await page.type('#LoginComponent input[type=text]', 'username');
  await page.type('#LoginComponent input[type=password]', 'password');
  page.click('#LoginComponent button[type=submit]');

  //await browser.close();
})();