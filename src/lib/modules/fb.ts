import puppeteer, { Browser, BrowserContext } from 'puppeteer';
import Options from '../models/options';
import Login from './login';
import Group from './group';
import { blankTab } from '../utils/fb_helpers';

declare global {
  interface Window {
    posts: HTMLElement[];
  }
}

/**
 * Create a Facebook instance
 * @param options Options object
 * @param browser To use an alternate browser
 */
export default class Facebook {
  private options: Options & { cookiesFile: string };

  private browser: Browser;

  private context: BrowserContext;

  constructor(
    options: Options,
    browser: Browser,
  ) {
    const defaults = {
      headless: true,
      height: 800,
      width: 700,
      maximized: false,
      debug: false,
      dumpio: false,
    };
    let { cookiesFile } = options;
    cookiesFile = cookiesFile === true ? 'fbjs_cookies.json' : cookiesFile;
    cookiesFile = cookiesFile ? `${cookiesFile.replace(/\.json$/g, '')}.json` : cookiesFile;
    this.options = {
      ...defaults,
      ...options,
      cookiesFile,
    };
    this.browser = browser;
    this.context = null!;
  }

  /**
   * Function initializes the Facebook module
   */
  public async init(): Promise<Facebook> {
    const browser = this.browser || await this.launchBrowser();
    /**
     * We need an incognito browser to avoid notification
     * and location permissions of Facebook
     */
    const incognitoContext = await browser.createIncognitoBrowserContext();
    this.context = incognitoContext;
    // Create a new browser tab
    await blankTab(incognitoContext, this.options);
    /**
     * Hide the default browser context as it's not needed
     * Closing the first tab does the job. We only close it if it is blank
     */
    const defaultBrowserContext = this.browser.defaultBrowserContext();
    const tab = await blankTab(defaultBrowserContext);
    if (tab) {
      tab.close();
    }
    return this;
  }

  /**
   * Function launches the browser
   */
  public async launchBrowser(): Promise<Browser> {
    const browserOptions: (
      puppeteer.LaunchOptions &
      puppeteer.BrowserLaunchArgumentOptions &
      puppeteer.BrowserConnectOptions &
      {
        product?: puppeteer.Product | undefined;
      }) = {
      headless: this.options.headless,
      dumpio: this.options.dumpio,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sendbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
      executablePath: this.options.executablePath,
    };
    if (this.options.maximized && !this.options.headless) {
      browserOptions.args?.push('--start-maximized');
    } else {
      browserOptions.args?.push(`--window-size=${this.options.width},${this.options.height}`);
    }
    if (!browserOptions.executablePath && (process.arch === 'arm' || process.arch === 'arm64')) {
      // If processor architecture is arm or arm64 we need to use chromium browser
      browserOptions.executablePath = 'chromium-browser';
    }
    this.browser = await puppeteer.launch(browserOptions);
    return this.browser;
  }

  /**
   * Function closes the browser/browser context
   * @param contextOnly Default to `false`.
   * Set to `true` to only close the context used by this Facebook instance.
   * Useful if you use a single browser with multiple instanses.
   */
  public close(contextOnly: boolean = false) {
    if (contextOnly) {
      this.context?.close();
    } else {
      this.browser?.close();
    }
  }

  /**
   * Function creates a Login instance
   */
  public login(): Login {
    return new Login(this.options, this.context);
  }

  /**
   * Function creates a Group instance
   * @param id The id of the group
   * @param sort The group feed sorting setting.
   * One of `RECENT_ACTIVITY`, `CHRONOLOGICAL` or `TOP_POSTS`.
   * @return Group The current group related to the scraper
   */
  public group(id: string, sort?: string): Group {
    return new Group(this.options, this.context, id, sort);
  }
}
