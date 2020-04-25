// pixivからもろもろのイラストを取得してアップロードするスクリプト
// usage: npm run start

import {log_safe_content, debugMode, preparePixivLoginedBrowserAndPage, postToVimagemore} from './utils'

// 参考: https://github.com/puppeteer/puppeteer/blob/master/docs/api.md
// 参考: https://qiita.com/rh_taro/items/32bb6851303cbc613124
(async () => {
  log_safe_content("Let's do this...");
  const {browser, page} = await preparePixivLoginedBrowserAndPage({
    username: process.env.PIXIV_USERNAME ?? '',
    password: process.env.PIXIV_PASSWORD ?? '',
  });

  // GitHub Actionsでどこで詰まっているのか分からないので、
  // タイムアウト直前っぽいタイミングでスクショを撮って送信してみる
  const dyingMessageTimeout = setTimeout(async () => {
    log_safe_content("Post dying message");
    const now = (new Date()).toLocaleString('ja-JP');
    const image = await page.screenshot({
      encoding: 'base64',
      type:     'jpeg',
      quality:  60,
    });
    return postToVimagemore({
      id: now,
      title: `Dying message at ${now}`,
      tags: ['DyingMessage', 'we-love-pixiv'],
      link: 'https://github.com/shimobayashi/we-love-pixiv/actions',
      image: image,
    });
  //}, 5.9 * 60 * 60 * 1000);
  }, 1000);

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
    log_safe_content('{Get figure}');
    const figureSelector = 'figure > div[role=presentation]';
    const figure = await page.waitForSelector(figureSelector, {timeout: 10000}).catch(error => {
      console.info(`${url}:`);
      log_safe_content(Error, error.message);
    });
    if (!figure) {
      log_safe_content('figure not found!');
      continue;
    };

    // ページタイトルから作品タイトルや著者名を取得する
    log_safe_content('{Get illust title and author}');
    const result = (await page.title()).match(/^(#.+\s)?(.+)\s-\s(.+)の.+\s-\spixiv$/);
    if (!result) {
      log_safe_content('failed to match title!');
      continue;
    }
    const illustTitle = result[2];
    const illustAuthor = result[3];

    // 作品に付けられたタグを取得する
    log_safe_content('{Get tags}');
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

    // コンテナのスクショを撮ってアップロード
    log_safe_content('{Get screenshot}');
    const title = `${illustTitle} - ${illustAuthor}`
    console.info('Title:', title);
    const image = await figure.screenshot({
      encoding: 'base64',
      type:     'jpeg',
      quality:  60,
    });
    postToVimagemore({
      id: (url.match(/^https:\/\/www\.pixiv\.net\/artworks\/(\d+)/) ?? [])[1],
      title: title,
      tags: illustTags,
      link: url,
      image: image,
    });
  }

  clearTimeout(dyingMessageTimeout);
  await browser.close();
})();