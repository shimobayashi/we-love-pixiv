// pixivのお気に入り類を非公開にするスクリプト
// usage: npm run start:private-favorites

import puppeteer from 'puppeteer';

// console.log系を生かしておくとミスってGitHub Actionsに意図しないログが大公開されてしまう可能性があるため、
// 基本的にはconsole.log系は何もしないようにしておく。
let log_safe_content = console.log; // 大丈夫そうなやつはこのメソッドを使ってロギングする
const debugMode:boolean = !!(process.env.DEBUG && process.env.DEBUG === '1'); // headlessもこれで制御しているので注意
if (!debugMode) {
  console.debug = function(){/* NOP */};
  console.info = function(){/* NOP */};
  console.log = function(){/* NOP */};
  console.warn = function(){/* NOP */};
  console.error = function(){/* NOP */};
}

// 参考: https://github.com/puppeteer/puppeteer/blob/master/docs/api.md
// 参考: https://qiita.com/rh_taro/items/32bb6851303cbc613124
(async () => {
  log_safe_content("Let's do this...");
  const browser = await puppeteer.launch({
    headless: !debugMode,
    slowMo: debugMode ? 50 : 500, // 人間が目で見てるわけでなさそうだったらなるべくサーバーをいたわる気持ちで動きを遅くしておく
  });
  const page = await browser.newPage();

  /*
   * ログインする
   */
  await page.goto('https://accounts.pixiv.net/login');
  // page.typeだとslowMoの分だけ待たされるので直接valueにぶち込む
  await page.evaluate((credential) => {
    document.querySelector('#LoginComponent input[type=text]')?.setAttribute('value', credential.username);
    document.querySelector('#LoginComponent input[type=password]')?.setAttribute('value', credential.password);
  }, {
    username: process.env.PIXIV_USERNAME ?? '',
    password: process.env.PIXIV_PASSWORD ?? '',
  });
  page.click('#LoginComponent button[type=submit]');
  await page.waitForNavigation();

  /*
   * フォローを非公開にする
   */
  log_safe_content('Follows:');
  {
    while (1) {
      await page.goto('https://www.pixiv.net/bookmark.php?type=user');
      const checkBoxes = await page.$$('#search-result input');
      log_safe_content('checkBoxes.length:', checkBoxes.length);
      if (checkBoxes.length === 0) {
          break;
      }
      for (let checkBox of checkBoxes) {
        await checkBox.click();
      }
      await page.click(".control input[name='hide']");
      await page.waitForNavigation();
    }
  }

  /*
   * ブックマークを非公開にする
   */
  log_safe_content('Bookmarks:');
  {
    while (1) {
      await page.goto('https://www.pixiv.net/bookmark.php');
      const checkBoxes = await page.$$('#wrapper input[type=checkbox]');
      log_safe_content('checkBoxes.length:', checkBoxes.length);
      if (checkBoxes.length === 0) {
          break;
      }
      for (let checkBox of checkBoxes) {
          await checkBox.click();
      }
      await page.click('.buttons input[name=hide]');
      await page.waitForNavigation();
    }
  }

  await browser.close();
})();