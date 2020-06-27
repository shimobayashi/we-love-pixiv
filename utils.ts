import puppeteer from 'puppeteer';
import axios from 'axios';

// console.log系を生かしておくとミスってGitHub Actionsに意図しないログが大公開されてしまう可能性があるため、
// 基本的にはconsole.log系は何もしないようにしておく。
export const log_safe_content = console.log; // 大丈夫そうなやつはこのメソッドを使ってロギングする
export const debugMode:boolean = !!(process.env.DEBUG && process.env.DEBUG === '1'); // headlessもこれで制御しているので注意
if (!debugMode) {
  console.debug = function(){/* NOP */};
  console.info = function(){/* NOP */};
  console.log = function(){/* NOP */};
  console.warn = function(){/* NOP */};
  console.error = function(){/* NOP */};
}

// pixivにログイン済みのpageを返す
// PHPSESSIDか認証情報のどちらかを渡す必要がある。が、認証情報を渡してもreCAPTCHAは突破できないのであまり意味はない
// ついでにタイムアウトしそうになったらスクショを取るように仕込んで、そのTimeoutオブジェクトも返す
export async function preparePixivLoginedBrowserAndPage({credential, phpsessid}:{credential?:{username:string, password:string}, phpsessid?:string}) {
  const browser = await puppeteer.launch({
    headless: !debugMode,
    slowMo: debugMode ? 50 : 100, // 人間が目で見てるわけでなさそうだったらなるべくサーバーをいたわる気持ちで動きを遅くしておく
  });
  const page = await browser.newPage();

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
  }, 5.9 * 60 * 60 * 1000);

  /*
   * ログインする
   */
  if (phpsessid) {
    await page.setCookie({name: 'PHPSESSID', value: phpsessid, domain: '.pixiv.net', httpOnly: true, secure: true, session: false});
    console.log(await page.cookies());
  } else if (credential) {
    await page.goto('https://accounts.pixiv.net/login');
    await page.waitForSelector('#LoginComponent input[type=text]');
    await page.waitForSelector('#LoginComponent input[type=password]');
    // page.typeだとslowMoの分だけ待たされるので直接valueにぶち込む
    await page.evaluate((credential) => {
      document.querySelector('#LoginComponent input[type=text]')?.setAttribute('value', credential.username);
      document.querySelector('#LoginComponent input[type=password]')?.setAttribute('value', credential.password);
    }, credential);
    await page.click('#LoginComponent button[type=submit]');
    await page.waitForNavigation();
  } else {
    throw "phpsessid or credential is needed.";
  }

  // チュートリアルバルーンみたいなのが邪魔なので表示されないようにしておく
  await page.goto('https://www.pixiv.net/'); // www.pixiv.netに移動してないとlocalStorageに触れないので移動
  await page.evaluate(() => {
    localStorage.setItem('showOnce', '{"previewModal":true}');
  });

  return {browser, page, dyingMessageTimeout};
}

interface Params {
  id: string;
  title: string;
  tags: string[];
  link: string;
  image: string;
}
export async function postToVimagemore(params:Params) {
  // 情報をまとめてアップロードする
  log_safe_content('{Post to vimagemore}');
  return axios.post(process.env.VIMAGEMORE_UPLOADER_URL ?? '', params).then((ret) => {
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