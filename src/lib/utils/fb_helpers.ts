import fs from 'fs';
import {
  Page, BrowserContext, HTTPResponse, ElementHandle,
} from 'puppeteer';
import Post from '../models/Post';
import Options from '../models/options';

export function generateFacebookGroupURLById(id: string, sort?: string): string {
  const url = sort
    ? `https://www.facebook.com/groups/${id}/?sorting_setting=${sort}`
    : `https://www.facebook.com/groups/${id}/`;
  return url;
}
/**
 * Function gets old publications.
 * @namespace getOldPublications
 * @param {type} fileName name of the file
 * @return {Object[]} returns the list of all publications.
 * */
export function getOldPublications(fileName: string): Post[] {
  let allPublicationsList;
  if (fs.existsSync(fileName)) {
    // If file exists
    allPublicationsList = JSON.parse(
      fs.readFileSync(fileName, { encoding: 'utf8' }),
    );
  } else {
    // If file does not exists
    allPublicationsList = [];
  }
  return allPublicationsList;
}

/**
 * Save post to the database
 * @param postData
 * @param outputFile
 */
export function savePost(postData: Post, outputFile: string): void {
  const allPublicationsList = getOldPublications(outputFile);
  allPublicationsList.push(postData);
  fs.writeFileSync(
    `./${outputFile}`,
    JSON.stringify(allPublicationsList, undefined, 4),
    { encoding: 'utf8' },
  );
}

/**
 * Function pauses the main execution for given number of seconds
 * @param duration The sleep duration
 */
export async function sleep(duration: number): Promise<void> {
  return new Promise(((resolve) => {
    setTimeout(resolve, duration);
  }));
}

/**
 * Function automatically scrolls
 */
export function autoScroll(): void {
  return window.scrollBy(0, document.body.scrollHeight);
}

/**
 * Function to add timeout to a promise
 * @param promise
 * @param time in ms
 */
export function promiseTimeout(promise: Promise<any>, time: number): Promise<any> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise((_res, rej) => {
      timer = setTimeout(() => rej(new Error('Timeout error!')), time);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Function accept cookies if the cookies pop-up appears.
 * @param page The current page
 */
export async function acceptCookies(page: Page) {
  try {
    await page.waitForXPath('//button[@data-cookiebanner="accept_button"]', { timeout: 2000 });
    const acceptCookiesButton = (await page.$x('//button[@data-cookiebanner="accept_button"]'))[0];
    await page.evaluate((el) => {
      el.focus();
      el.click();
    }, acceptCookiesButton);
  } catch {
    // We can not have empty blocks, so we are calling a function which do literally nothing
    (() => {})();
  }
}

/**
 * Function disables the loading of assets to improve performance
 */
export async function disableAssetsLoad(page: Page) {
  await page.setRequestInterception(true);
  const blockResources = [
    'image', 'media', 'font', 'textrack', 'object',
    'beacon', 'csp_report', 'imageset',
  ];
  page.on('request', (request) => {
    const rt = request.resourceType();
    if (
      blockResources.indexOf(rt) > 0
              || request.url()
                .match(/\.((jpe?g)|png|gif)/) != null
    ) {
      request.abort();
    } else {
      request.continue();
    }
  });
}

/**
 * Get the very first blank tab if exists, otherwise open a new one
 * @param context The browser context that the tab belongs to
 * @param options Options object. Required to open a new tab
 */
export async function blankTab(
  context: BrowserContext,
  options?: Options & { cookiesFile: string },
): Promise<Page | undefined> {
  const pages = await context.pages();
  let page = pages.find((p) => p.url() === 'about:blank');
  if (!page && options) {
    page = await context.newPage();
    if (options.changeUserAgent) {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36');
    }
    let cookiesString;
    if (options.cookiesString) {
      cookiesString = options.cookiesString;
    } else if (options.cookiesFile && fs.existsSync(options.cookiesFile)) {
      cookiesString = fs.readFileSync(options.cookiesFile);
    }
    if (cookiesString) {
      const cookies = JSON.parse(cookiesString.toString());
      await page.setCookie(...cookies);
    }
  }
  return page;
}

/**
 * Function checks login status
 * @param res The return of `goto()`
 * @return `true` if the user is logged in, `false` if not
 */
export async function checkLoginStatus(res: HTTPResponse): Promise<boolean> {
  const body = await res.text();
  return !body.includes('<meta name="description"');
}

export async function selectHnd(
  parent: ElementHandle | Page,
  selector: string,
): Promise<ElementHandle | null> {
  let hnd;
  try {
    hnd = await parent.$(selector);
  } catch {
    hnd = null;
  }
  return hnd;
}
