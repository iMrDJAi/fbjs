import { BrowserContext, ElementHandle, Page } from 'puppeteer';
import {
  autoScroll, generateFacebookGroupURLById, savePost,
  promiseTimeout, blankTab, disableAssetsLoad, selectHnd,
} from '../utils/fb_helpers';
import Group_post from '../models/group_post';
import Options from '../models/options';
import Selectors from '../utils/Selectors';

const selectors = JSON.parse(JSON.stringify({ ...Selectors }));

export default class Group {
  private options: Options & { cookiesFile: string };

  private context: BrowserContext;

  private page: Page;

  private id: string;

  private sort? : string;

  private get url() {
    return generateFacebookGroupURLById(this.id, this.sort);
  }

  private stopped: boolean = false;

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
  }

  /**
   * Function saves the group posts
   * @param callback
   * @param outputFile
   * @param disableAssets Disable loading assets to improve performance. Defaults to `true`.
   */
  public async getPosts(
    callback: (arg0: Group_post) => void,
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
    await this.page.waitForSelector(selectors.group.name);

    // Extract the group name
    const groupNameElm = await this.page.$(selectors.group.name);
    const groupName = await this.page.evaluate(
      (el: HTMLElement) => el.textContent,
      groupNameElm,
    );
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
    await this.page.waitForSelector(selectors.group.feed_container);

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
      }
    };

    // Expose `handlePosts()` to browser
    this.page.exposeFunction('handlePosts', handlePosts);

    // Listen to new fetched posts
    const listen = (sel: typeof Selectors) => {
      window.posts = [];
      const target = <HTMLElement>document.querySelector(
        sel.group.feed_container,
      );
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
    this.page.evaluate(listen, selectors);
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
        permalink: string | null,
        id: string | null;

      /**
       * We need to hover over that element to load the post permalink
       * and to grab the post date (annoying stuff).
       * Moving the mouse or scrolling or minimizing the window will prevent
       * the script from hovering and this will cause errors, because of that
       * we recommend users to run the scraper under the headless mode.
       * */
      const postLink = (await postHnd.$(selectors.post.permalink))!;

      // Reset cursor position
      try {
        await promiseTimeout(this.page?.mouse.move(0, 0)!, 200);
      } catch (err: any) {
        console.error('Move: ', err.message);
        return await getPostMetadata();
      }

      // Hover
      try {
        await promiseTimeout(postLink.hover(), 200);
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
          {},
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
      } catch (err: any) {
        console.error('Date: ', err.message);
        return await getPostMetadata();
      }

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
      // False positive ._.

      // Reset cursor position again
      try {
        await promiseTimeout(this.page?.mouse.move(0, 0)!, 200);
      } catch (err: any) {
        console.error('Move: ', err.message);
        return await getPostMetadata();
      }

      return {
        date,
        permalink,
        id,
      };
    };

    const postMetadata = await getPostMetadata();

    const getPostAuthor = async (postElm: HTMLElement, sel: typeof Selectors) => {
      let authorName: string | null,
        authorUrl: string | null,
        authorAvatar: string | null;

      // Not all posts provide the author profile url
      let authorElm = <HTMLElement>postElm.querySelector(sel.post.author_name);

      if (authorElm) {
        authorName = authorElm.innerText;
        authorUrl = authorElm.getAttribute('href')!.replace(/(\/?\?.+)$/, '');
      } else {
        authorElm = <HTMLElement>postElm.querySelector(sel.post.author_name_alt);
        authorName = authorElm.innerText;
        authorUrl = null;
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

      return {
        authorName,
        authorUrl,
        authorAvatar,
      };
    };

    const postAuthor = await this.page.evaluate(getPostAuthor, postHnd, selectors);

    const getPostContent = async (): Promise<any> => {
      let contentText: string | null,
        contentHtml: string | null,
        background: string | null,
        images: any[] = [];

      let txt = await selectHnd(postHnd, selectors.post.txt);
      const seeOg = await selectHnd(postHnd, selectors.post.see_og);

      if (!txt && seeOg) {
        await seeOg.click();
        await this.page.waitForFunction(
          (el: HTMLElement, sel: typeof Selectors) => !!el.querySelector(sel.post.txt),
          {},
          postHnd,
          selectors,
        );
        txt = await selectHnd(postHnd, selectors.post.txt);
      }

      const isTxt = await selectHnd(postHnd, selectors.post.is_txt);
      const bg = await selectHnd(postHnd, selectors.post.bg);
      const bgTxt = await selectHnd(postHnd, selectors.post.bg_txt);

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

        const seeMore = await selectHnd(txtElm, selectors.post.see_more);
        if (seeMore) {
          const textLength = await this.page.evaluate(
            (el: HTMLElement) => el.innerText.length,
            txtElm,
          );
          await seeMore.click();
          await this.page.waitForFunction(
            (el: HTMLElement, len: number) => el.innerText.length !== len,
            {},
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

      const attach = await selectHnd(postHnd, selectors.post.attach);
      const isAttach = await selectHnd(postHnd, selectors.post.is_attach);

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
      }

      return {
        contentText,
        contentHtml,
        background,
        images,
      };
    };

    const postContent = await getPostContent();

    // creates a post object which contains our post
    const groupPost: Group_post = {
      authorName: <string>postAuthor.authorName,
      authorUrl: <string | null>postAuthor.authorUrl,
      authorAvatar: <string | null>postAuthor.authorAvatar,
      date: <string>postMetadata.date,
      permalink: <string>postMetadata.permalink,
      id: <string>postMetadata.id,
      contentText: <string | null>postContent.contentText,
      contentHtml: <string | null>postContent.contentHtml,
      background: <string | null>postContent.background,
      images: <any[]>postContent.images,
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