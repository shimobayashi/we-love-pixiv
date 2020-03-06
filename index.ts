// usage: npx ts-node index.ts

import puppeteer from 'puppeteer';

// 参考: https://github.com/puppeteer/puppeteer/blob/master/docs/api.md
// 参考: https://qiita.com/rh_taro/items/32bb6851303cbc613124
(async () => {
  const browser = await puppeteer.launch({
    headless: false, //XXX 後でtrueにする
    slowMo: 500,
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
  // なんかダイアログが出るので一応消しておく
  // 参考: https://qiita.com/shora_kujira16/items/34cb4074dfa715007698
  const xpath = `//button[text() = "わかった"]`;
  await page.waitForXPath(xpath); //XXX そのうちこのダイアログが出なくなると永遠に待つことになりそうなので、なんかタイムアウトを設定したい
  await (await page.$x(xpath))[0].click();

  /*
   * フォロー新着作品の詳細ページURLを取得
   */
  let figureUrls:Array<string> = [];
  for (let p = 1; p <= 1; p++) { // XXX
    await page.goto(`https://www.pixiv.net/bookmark_new_illust.php?p=${p}`);

    // 参考: https://qiita.com/go_sagawa/items/85f97deab7ccfdce53ea
    let figures = await page.$$('#js-mount-point-latest-following figure');
    for (let figure of figures) {
      let li = await figure.$('figcaption li:nth-child(1) a');
      if (!li) continue;

      let figureUrl = (await (await li.getProperty('href')).jsonValue()) + '';
      figureUrls.push(figureUrl);
    }
  }
  console.log('figureUrls', figureUrls);

  /*
   * 詳細ページURLからvimagemoreへ投稿 
   */
  for (let url of figureUrls) {
    console.log('TODO', url);
    await page.goto(url);
    const imgSelector = 'div[role=presentation] a > img';
    await page.waitForSelector(imgSelector);
    let img = await page.$(imgSelector);
    if (!img) continue;

    //XXX とりあえずスクショ撮影してるけどvimagemoreに投稿したい
    await img.screenshot({
      path: 'figure.png' ,
    });

    console.log('ok!');
    break; //XXX とりあえず最初の画像だけ処理
  }

  await browser.close();
})();