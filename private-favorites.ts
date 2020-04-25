// pixivのお気に入り類を非公開にするスクリプト
// usage: npm run start:private-favorites

import {log_safe_content, debugMode, preparePixivLoginedBrowserAndPage} from './utils'

// 参考: https://github.com/puppeteer/puppeteer/blob/master/docs/api.md
// 参考: https://qiita.com/rh_taro/items/32bb6851303cbc613124
(async () => {
  log_safe_content("Let's do this...");
  const {browser, page, dyingMessageTimeout} = await preparePixivLoginedBrowserAndPage({
    username: process.env.PIXIV_USERNAME ?? '',
    password: process.env.PIXIV_PASSWORD ?? '',
  });

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

  clearTimeout(dyingMessageTimeout);
  await browser.close();
})();