// usage: npx ts-node index.ts

import puppeteer from 'puppeteer';
import axios, { AxiosError } from 'axios';

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
   * フェッチ対象となる作品詳細URLを集める
   */
  const figureUrls:Array<string> = [];
  let pageUrls = [ // 対象とする作品が集まってるページURLを列挙する
    'https://www.pixiv.net/bookmark_new_illust.php', // フォロー新着作品
    'https://www.pixiv.net/discovery', // おすすめ作品
  ];
  // それぞれのページからfigure要素を抜き出して作品詳細URLを集める
  for (let pageUrl of pageUrls) {
    await page.goto(pageUrl);

    // 参考: https://qiita.com/go_sagawa/items/85f97deab7ccfdce53ea
    const figures = await page.$$('figure');
    for (const figure of figures) {
      const li = await figure.$('figcaption li:nth-last-child(2) a'); // seriesの場合はliが3つになり、最初はseriesへのリンク
      if (!li) continue;

      const figureUrl = (await (await li.getProperty('href')).jsonValue()) + '';
      figureUrls.push(figureUrl);
    }
  }
  log_safe_content('figureUrls.length:', figureUrls.length);
  console.info('figureUrls:', figureUrls);

  /*
   * 詳細ページURLからvimagemoreへ投稿 
   */
  for (let url of figureUrls) {
    log_safe_content('[Processing]');
    console.info(url);
    await page.goto(url);

    // イラストやうごイラが表示されているコンテナを取得する
    const figureSelector = 'figure > div[role=presentation]';
    await page.waitForSelector(figureSelector);
    const figure = await page.$(figureSelector);
    if (!figure) {
      log_safe_content('figure not found!');
      continue;
    };

    // ページタイトルから作品タイトルや著者名を取得する
    const result = (await page.title()).match(/^(#.+\s)?(.+)\s-\s(.+)の.+\s-\spixiv$/);
    if (!result) {
      log_safe_content('failed to match title!');
      continue;
    }
    const illustTitle = result[2];
    const illustAuthor = result[3];

    // 作品に付けられたタグを取得する
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

    // コンテナのスクショを撮ってアップロードする
    const params = {
      id: (url.match(/^https:\/\/www\.pixiv\.net\/artworks\/(\d+)/) ?? [])[1],
      title: `${illustTitle} - ${illustAuthor}`,
      tags: illustTags,
      link: url,
      image: '',
    };
    console.info('Title:', params.title);
    //console.info(params);
    params.image = await figure.screenshot({
      encoding: 'base64',
    });
    axios.post(process.env.VIMAGEMORE_UPLOADER_URL ?? '', params).then((ret) => {
      log_safe_content('Success');
      console.info(`${params.title}:`);
      log_safe_content(ret.status);
    }).catch((error) => {
      // 重複したidを指定しているとエラーが返ってくるのでまあまあガンガンエラーが流れてくるはず
      log_safe_content('Error');
      console.info(`${params.title}:`);
      log_safe_content(error.message);
    })
  }

  await browser.close();
})();