// usage: npx ts-node index.ts

import puppeteer from 'puppeteer';

// 参考: https://github.com/puppeteer/puppeteer/blob/master/docs/api.md
// 参考: https://qiita.com/rh_taro/items/32bb6851303cbc613124
(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 0, //XXX 0だと勢いよくクロールしてしまうかも知れないので適当な値を入れたほうが良さそう(page.typeとか超遅くなるのでなんとかしたい)
  });
  const page = await browser.newPage();

  /* ログイン */
  await page.goto('https://accounts.pixiv.net/login');
  await page.type('#LoginComponent input[type=text]', process.env.PIXIV_USERNAME ?? '');
  await page.type('#LoginComponent input[type=password]', process.env.PIXIV_PASSWORD ?? '');
  page.click('#LoginComponent button[type=submit]');
  //await page.waitForNavigation({timeout: 60000, waitUntil: 'domcontentloaded'});

  // 参考: https://qiita.com/shora_kujira16/items/34cb4074dfa715007698
  // 別にダイアログが出たまま操作しても問題ないかも知れない
  const xpath = `//button[text() = "わかった"]`;
  await page.waitForXPath(xpath);
  await (await page.$x(xpath))[0].click();

  /* フォロー新着作品 */
  await page.goto('https://www.pixiv.net/bookmark_new_illust.php');
  // 参考: https://qiita.com/go_sagawa/items/85f97deab7ccfdce53ea
  let figures = await page.$$('#js-mount-point-latest-following figure');
  for (let figure of figures) {
    // とりあえず試しに作品に関する情報とスクリーンショットを撮ってみる
    for (let li of (await figure.$$('figcaption li a'))) {
      console.log(await (await li.getProperty('href')).jsonValue());
      console.log(await (await li.getProperty('innerText')).jsonValue());
    }
    console.log('---');
    await figure.screenshot({
      path: 'figure.png' ,
    });
  }

  await browser.close();
})();