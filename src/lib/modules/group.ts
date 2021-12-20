import { BrowserContext, ElementHandle, Page } from 'puppeteer';
import {
  autoScroll, generateFacebookGroupURLById, savePost, promiseTimeout,
  blankTab, disableAssetsLoad, selectHnd, normalizeURL, normalizeImgURL,
} from '../utils/fb_helpers';
import Post from '../models/Post';
import Options from '../models/options';
import Selectors from '../utils/Selectors';

const selectors = JSON.parse(JSON.stringify({ ...Selectors }));

export default class Group {
  public options: Options & { cookiesFile: string };

  public context: BrowserContext;

  public page: Page;

  public id: string;

  public sort? : string;

  public get url() {
    return generateFacebookGroupURLById(this.id, this.sort);
  }

  public name: string;

  public stopped: boolean = false;

  constructor(
    options: Options & { cookiesFile: string },
    context: BrowserContext,
    id: string,
    sort?: string,
  ) {
    this.options = options;
    this.context = context;
    this.page = null!;
    this.id = id;
    this.sort = sort;
    this.name = null!;
  }

  /**
   * Function saves the group posts
   * @param callback
   * @param outputFile
   * @param disableAssets Disable loading assets to improve performance. Defaults to `true`.
   */
  public async getPosts(
    callback: (arg0: Post | null) => void,
    outputFile: string | true,
    disableAssets: boolean = true,
  ) {
    this.stopped = false;

    let outputFileName = outputFile === true ? `${this.id}.json` : outputFile;
    outputFileName = outputFileName ? `${outputFileName.replace(/\.json$/g, '')}.json` : outputFileName;

    // Go to the group page
    this.page = this.page || (await blankTab(this.context, this.options))!;
    await this.page.goto(
      this.url,
      {
        timeout: 600000,
      },
    );

    if (disableAssets) {
      await disableAssetsLoad(this.page);
    }

    /**
     * Waiting for the group name before we continue
     * to avoid "selector not found" error.
     */
    await this.page.waitForSelector(Selectors.group.name);

    // Extract the group name
    const groupNameElm = await this.page.$(Selectors.group.name);
    const groupName = await this.page.evaluate(
      (el: HTMLElement) => el.textContent!,
      groupNameElm,
    );
    this.name = groupName;
    console.log(groupName);

    /**
     * Scroll down a little bit to load posts.
     * The `hover()` method located in `parsePost()` will continue scrolling
     * automatically over posts all the way down, so we only need to execute this once.
     * To ensure that it will work we need a small delay after the page finishes loading,
     * waiting for the group name will provide us that delay.
     */
    this.page.evaluate(autoScroll);

    /**
     * Waiting for the group feed container before we continue
     * to avoid "selector not found" error.
     * Note that we ignore any posts outside this container,
     * specifically announcements, because they don't follow
     * the same sorting method as the others.
     */
    await this.page.waitForSelector(Selectors.group.feed);
    const feed = (await this.page.$(Selectors.group.feed))!;

    /**
     * This will ensure that the function `handlePosts`
     * won't run more than once at the same time.
     */
    let busy = false;

    /**
     * Handle new fetched posts
     * @param force
     */
    const handlePosts = async (force: boolean): Promise<void> => {
      if (this.stopped) {
        await this.page.goto('about:blank');
        return;
      }
      if (busy && !force) return;
      busy = true;
      const postHnd = await this.page?.evaluateHandle(() => window.posts.shift());
      if (postHnd?.toString() !== 'JSHandle:undefined') {
        const postData = await this.parsePost(<ElementHandle>postHnd);
        if (callback) callback(postData);
        if (outputFileName) savePost(postData, outputFileName);
        handlePosts(true);
      } else {
        busy = false;
        this.page.evaluate(autoScroll);
        const isLoading = await selectHnd(feed, Selectors.group.feed_is_loading);
        if (!isLoading) {
          this.stop();
          await handlePosts(true);
          if (callback) callback(null);
        }
      }
    };

    // Expose `handlePosts()` to browser
    this.page.exposeFunction('handlePosts', handlePosts);

    // Listen to new fetched posts
    const listen = (target: HTMLElement, sel: typeof Selectors) => {
      window.posts = Array.from(target.querySelectorAll(sel.post.element));
      const observer = new MutationObserver((mutations) => {
        for (let i = 0; i < mutations.length; i += 1) {
          for (let j = 0; j < mutations[i].addedNodes.length; j += 1) {
            const addedNode = <HTMLElement>mutations[i].addedNodes[j];
            const postElm = <HTMLElement>addedNode.querySelector(sel.post.element);
            if (postElm) {
              window.posts.push(postElm);
              handlePosts(false);
            }
          }
        }
      });
      observer.observe(target, { childList: true });
    };

    // Start Listening
    this.page.evaluate(listen, feed, selectors);
  }

  /**
   * Extract data from a post
   * @param post
   */
  private async parsePost(postHnd: ElementHandle) {
    /**
     * Get post metadata
     * @returns date, permalink, id
     */
    const getPostMetadata = async (): Promise<any> => {
      let date: string | null,
        timestamp: number,
        permalink: string | null,
        id: string | null;

      /**
       * We need to hover over that element to load the post permalink
       * and to grab the post date (annoying stuff).
       * Moving the mouse or scrolling or minimizing the window will prevent
       * the script from hovering and this will cause errors, because of that
       * we recommend users to run the scraper under the headless mode.
       * */
      const postLink = (await postHnd.$(Selectors.post.permalink))!;

      // Reset cursor position
      try {
        await promiseTimeout(this.page?.mouse.move(0, 0)!, 200);
      } catch (err: any) {
        console.error('Move: ', err.message);
        return await getPostMetadata();
      }

      // Scroll to element
      try {
        await this.page.evaluate(
          (el: HTMLElement) => {
            el.scrollIntoView({ block: 'center', inline: 'nearest' });
          },
          postLink,
        );
      } catch (err: any) {
        console.error('Scroll: ', err.message);
        return await getPostMetadata();
      }

      // Hover
      try {
        await promiseTimeout(postLink.hover(), 500);
      } catch (err: any) {
        console.error('Hover: ', err.message);
        // That's why you should not minimize the browser window
        if (err.message === 'Node is either not visible or not an HTMLElement') {
          await new Promise((res) => setTimeout(res, 1000));
        }
        return await getPostMetadata();
      }

      // Waiting for tooltip to appear
      try {
        await this.page.waitForFunction(
          (el: HTMLElement) => {
            const span = el.parentElement!;
            return span.getAttribute('aria-describedby') !== null;
          },
          { timeout: 800 },
          postLink,
        );
      } catch (err: any) {
        console.error('Tooltip: ', err.message);
        return await getPostMetadata();
      }

      // Grab the date
      try {
        date = await this.page.evaluate(
          (el: HTMLElement) => {
            const span = el.parentElement!;
            const tooltipID = span.getAttribute('aria-describedby')!;
            const tooltip = document.getElementById(tooltipID);
            if (!tooltip) {
              throw new Error('Tooltip not found!');
            }
            return tooltip.innerText;
          },
          postLink,
        );
        date = date.replace('at ', '');
      } catch (err: any) {
        console.error('Date: ', err.message);
        return await getPostMetadata();
      }

      // Date to timestamp
      // eslint-disable-next-line
      timestamp = + new Date(date);
      // False positive ._.

      // Grab the permalink
      try {
        permalink = await this.page.evaluate(
          (el: HTMLElement) => el.getAttribute('href')!.replace(/(\/\?.+)$/, ''),
          postLink,
        );
      } catch (err: any) {
        console.error('Permalink: ', err.message);
        return await getPostMetadata();
      }

      // Extract the id
      // eslint-disable-next-line
      id = permalink.replace(/^.+\//, '');
      // False positive v2 ._.

      // Reset cursor position again
      try {
        await promiseTimeout(this.page?.mouse.move(0, 0)!, 200);
      } catch (err: any) {
        console.error('Move: ', err.message);
        return await getPostMetadata();
      }

      return {
        date,
        timestamp,
        permalink,
        id,
      };
    };

    const postMetadata = await getPostMetadata();

    const getPostAuthor = async (postElm: HTMLElement, sel: typeof Selectors) => {
      let authorName: string | null,
        authorUrl: string | null,
        authorGrpPf: string | null,
        authorAvatar: string | null,
        activity: string | null;

      // Not all posts provide the author profile url
      let authorElm = <HTMLElement>postElm.querySelector(sel.post.author_name);

      if (authorElm) {
        authorName = authorElm.innerText;
        const url = authorElm.getAttribute('href')!.replace(/(\/?\?.+)$/, '');
        authorUrl = `https://www.facebook.com/profile${url.replace(/\/groups\/\d+\/user/, '')}`;
        authorGrpPf = `https://www.facebook.com${url}`;
      } else {
        authorElm = <HTMLElement>postElm.querySelector(sel.post.author_name_alt);
        authorName = authorElm.innerText;
        authorUrl = null;
        authorGrpPf = null;
      }

      /**
       * Also, not all posts provide the author avatar.
       * You should authenticate to get rid of these limitations.
       */
      const authorAvatarElm = <HTMLElement>postElm.querySelector(sel.post.author_avatar);
      if (authorAvatarElm) {
        authorAvatar = authorAvatarElm.getAttribute('xlink:href')!;
      } else {
        authorAvatar = null;
      }

      const activityElm = <HTMLElement>postElm.querySelector(sel.post.activity);
      const nodes = Array.from(activityElm.childNodes);
      nodes.shift();

      // eslint-disable-next-line
      activity = nodes.map((node) => node.textContent).join('') || null;

      return {
        authorName,
        authorUrl,
        authorGrpPf,
        authorAvatar,
        activity,
      };
    };

    const postAuthor = await this.page.evaluate(getPostAuthor, postHnd, selectors);

    const getPostContent = async (): Promise<any> => {
      let contentText: string | null,
        contentHtml: string | null,
        background: string | null,
        images: any[] = [],
        url: string | null = null,
        file: { name: string, url: string } | null = null;

      let txt = await selectHnd(postHnd, Selectors.post.txt);
      const seeOg = await selectHnd(postHnd, Selectors.post.see_og);

      if (!txt && seeOg) {
        await seeOg.click();
        await this.page.waitForFunction(
          (el: HTMLElement, sel: typeof Selectors) => !!el.querySelector(sel.post.txt),
          { timeout: 2000 },
          postHnd,
          selectors,
        );
        txt = await selectHnd(postHnd, Selectors.post.txt);
      }

      const isTxt = await selectHnd(postHnd, Selectors.post.is_txt);
      const bg = await selectHnd(postHnd, Selectors.post.bg);
      const bgTxt = await selectHnd(postHnd, Selectors.post.bg_txt);

      if (txt && isTxt) {
        const txtElm = bgTxt || txt;

        if (bg) {
          const style = await this.page.evaluate(
            (el: HTMLElement) => el.getAttribute('style'),
            bg,
          ) || '';
          const match = style.match(/url\("(.+)"\)/);
          background = match ? match[1] : null;
        } else {
          background = null;
        }

        const seeMore = await selectHnd(txtElm, Selectors.post.see_more);
        if (seeMore) {
          const textLength = await this.page.evaluate(
            (el: HTMLElement) => el.innerText.length,
            txtElm,
          );
          await seeMore.click();
          await this.page.waitForFunction(
            (el: HTMLElement, len: number) => el.innerText.length !== len,
            { timeout: 2000 },
            txtElm,
            textLength,
          );
        }
        const { innerText, innerHTML } = await this.page.evaluate(
          (el: HTMLElement) => ({
            innerText: el.innerText,
            innerHTML: el.innerHTML,
          }),
          txtElm,
        );
        contentText = innerText;
        contentHtml = innerHTML;
      } else {
        contentText = null;
        contentHtml = null;
        background = null;
      }

      const attach = await selectHnd(postHnd, Selectors.post.attach);
      const isAttach = await selectHnd(postHnd, Selectors.post.is_attach);

      if (attach && isAttach) {
        images = await this.page.evaluate(
          (el: HTMLElement, sel: typeof Selectors) => {
            const imgs: any[] = [];
            const imgElms = Array.from(el.querySelectorAll(sel.post.img));
            imgElms.forEach((imgElm) => {
              const src = imgElm.getAttribute('src');
              imgs.push(src);
            });
            return imgs;
          },
          attach,
          selectors,
        );
        images = images.map(normalizeImgURL);

        url = await this.page.evaluate(
          (el: HTMLElement, sel: typeof Selectors) => {
            const urlElm = el.querySelector(sel.post.url);
            if (urlElm) {
              return urlElm.getAttribute('href')!;
            }
            return null;
          },
          attach,
          selectors,
        );
        url = normalizeURL(url);

        file = await this.page.evaluate(
          (el: HTMLElement, sel: typeof Selectors) => {
            const fileElm = el.querySelector(sel.post.file);
            if (fileElm) {
              return {
                name: fileElm.getAttribute('aria-label')!,
                url: fileElm.getAttribute('href')!,
              };
            }
            return null;
          },
          attach,
          selectors,
        );
      }

      return {
        contentText,
        contentHtml,
        background,
        images,
        url,
        file,
      };
    };

    const postContent = await getPostContent();

    // creates a post object which contains our post data
    const groupPost: Post = {
      groupName: <string> this.name,
      groupUrl: <string> this.url,
      authorName: <string>postAuthor.authorName,
      authorUrl: <string | null>postAuthor.authorUrl,
      authorGrpPf: <string | null>postAuthor.authorGrpPf,
      authorAvatar: <string | null>postAuthor.authorAvatar,
      activity: <string | null>postAuthor.activity,
      date: <string>postMetadata.date,
      timestamp: <number>postMetadata.timestamp,
      permalink: <string>postMetadata.permalink,
      id: <string>postMetadata.id,
      contentText: <string | null>postContent.contentText,
      contentHtml: <string | null>postContent.contentHtml,
      background: <string | null>postContent.background,
      images: <any[]>postContent.images,
      url: <string | null>postContent.url,
      file: <string | null>postContent.file,
    };

    return groupPost;
  }

  /**
   * Stop current operation
   */
  public async stop() {
    this.stopped = true;
    try {
      await this.page.waitForNavigation();
      return true;
    } catch {
      return false;
    }
  }
}
