// usage: npx ts-node index.ts

import puppeteer from 'puppeteer';
import axios, { AxiosError } from 'axios';

// 参考: https://github.com/puppeteer/puppeteer/blob/master/docs/api.md
// 参考: https://qiita.com/rh_taro/items/32bb6851303cbc613124
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    slowMo: 50,
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
  await page.waitForXPath(xpath, {
    timeout: 3000,
  });
  await (await page.$x(xpath))[0].click();

  /*
   * フォロー新着作品の詳細ページURLを取得
   */
  const figureUrls:Array<string> = [];
  for (let p = 1; p <= 2; p++) {
    await page.goto(`https://www.pixiv.net/bookmark_new_illust.php?p=${p}`);

    // 参考: https://qiita.com/go_sagawa/items/85f97deab7ccfdce53ea
    const figures = await page.$$('#js-mount-point-latest-following figure');
    for (const figure of figures) {
      const li = await figure.$('figcaption li:nth-last-child(2) a'); // seriesの場合はliが3つになり、最初はseriesへのリンク
      if (!li) continue;

      const figureUrl = (await (await li.getProperty('href')).jsonValue()) + '';
      figureUrls.push(figureUrl);
    }
  }
  console.info('figureUrls:', figureUrls, figureUrls.length);

  /*
   * 詳細ページURLからvimagemoreへ投稿 
   */
  for (let url of figureUrls) {
    console.info('[Processing]', url);
    await page.goto(url);

    const imgSelector = 'div[role=presentation] a > img';
    await page.waitForSelector(imgSelector);
    const img = await page.$(imgSelector);
    if (!img) {
      console.error('img not found!');
      continue;
    };

    const result = (await page.title()).match(/^(#.+\s)?(.+)\s-\s(.+)の.+\s-\spixiv$/);
    if (!result) {
      console.error('failed to match title!');
      continue;
    }
    const illustTitle = result[2];
    const illustAuthor = result[3];

    const illustTags:Array<string> = [];
    {
      const tags = await page.$$('figcaption footer li');
      for (const tag of tags) {
        const innerText = (await (await tag.getProperty('innerText')).jsonValue()) + '';
        if (innerText !== '') illustTags.push(innerText);
      }
    }
    // R-18タグなどが含まれなければ検索性のためにR-00タグを付与する
    if (!(illustTags.some(tag => /^R-18G?$/.test(tag)))) {
      illustTags.unshift('R-00');
    }

    const params = {
      id: (url.match(/^https:\/\/www\.pixiv\.net\/artworks\/(\d+)/) ?? [])[1],
      title: `${illustTitle} - ${illustAuthor}`,
      tags: illustTags,
      link: url,
      image: '',
    };
    console.info('Title:', params.title);
    //console.info(params);
    params.image = await img.screenshot({
      encoding: 'base64',
    });
    axios.post(process.env.VIMAGEMORE_UPLOADER_URL ?? '', params).then((ret) => {
      console.info(`Success(${params.title}):`, ret.status);
    }).catch((error) => {
      // 重複したidを指定しているとエラーが返ってくるのでまあまあガンガンエラーが流れてくるはず
      console.info(`Error(${params.title}):`, error.message);
    })
  }

  await browser.close();
})();