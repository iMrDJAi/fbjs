/* eslint-disable no-await-in-loop */
import fs from 'fs';
import { BrowserContext, Page } from 'puppeteer';
import Credentials from '../models/credentials';
import Options from '../models/options';
import TwoFARequiredError from '../errors/two_fa_required_error';
import { acceptCookies, blankTab, checkLoginStatus } from '../utils/fb_helpers';
import Selectors from '../utils/Selectors';

/**
 * Create a Login instance
 * @param options Options object
 * @param context The browser context that the login page belongs to
 */
export default class Login {
  private url = 'https://www.facebook.com';

  private altUrl = 'https://facebook.com';

  private options: Options & { cookiesFile: string };

  private context: BrowserContext;

  private page: Page;

  constructor(
    options: Options & { cookiesFile: string },
    context: BrowserContext,
  ) {
    this.options = options;
    this.context = context;
    this.page = null!;
  }

  /**
   * Function handles Facebook login
   * @param credentials The Facebook login credentials
   * Omit this if you just want to check login status
   * @return `cookies` string if the user is logged in, `null` if not
   */
  public async login(credentials?: Credentials): Promise<string | null> {
    this.page = (await blankTab(this.context, this.options))!;
    // Goes to base facebook url
    const res = await this.page.goto(this.url);

    // Checks for login status
    const isLoggedIn = await checkLoginStatus(res);
    if (isLoggedIn || !credentials) {
      const cookies = isLoggedIn ? await this.handleCookies(false) : null;
      await this.page.goto('about:blank');
      return cookies;
    }

    // Accepts cookies if needed
    await acceptCookies(this.page);

    await this.completeLoginForm(credentials.username, credentials.password);
    if (await this.checkFor2FA()) {
      throw new TwoFARequiredError();
    }
    await this.page.waitForXPath('//div[@data-pagelet="Stories"]');

    const cookies = await this.handleCookies();
    await this.page.goto('about:blank');
    return cookies;
  }

  /**
   * Function completes the login form
   * @param username The username to write in the username field
   * @param password The password to write in the password field
   * @private
   */
  private async completeLoginForm(username: string, password: string) {
    await this.page.waitForSelector(Selectors.login_form.parent);
    // Focusing to the email input
    await this.page.focus(Selectors.login_form.email);
    // Typing on the email input the email address
    await this.page.keyboard.type(username);
    // Focusing on the password input
    await this.page.focus(Selectors.login_form.password);
    // Typing the facebook password on password input
    await this.page.keyboard.type(password);
    // Clicking on the submit button
    await this.page.waitForXPath('//button[@data-testid="royal_login_button"]');
    const [loginButton] = await this.page.$x('//button[@data-testid="royal_login_button"]');
    await loginButton.click();
  }

  /**
   * Function tests if the 2FA input appeared
   * @return `true` if 2FA banner is appeared, `false` if not
   * @private
   */
  private async checkFor2FA(): Promise<boolean> {
    try {
      await this.page.waitForXPath('//form[contains(concat(" ", normalize-space(@class), " "), " checkpoint")]');
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Function enters the two factor authentication code
   * @param authCode The two factor authentication code
   * @return Cookies string
   */
  public async enterAuthCode(authCode: string) {
    const authCodeInputSelector = '//input[contains(concat(" ", normalize-space(@name), " "), " approvals_code")]';
    const authCodeContinueButtonSelector = '//button[contains(concat(" ", normalize-space(@id), " "), " checkpointSubmitButton")]';

    await this.page.waitForXPath(authCodeInputSelector);
    await (await this.page.$x(authCodeInputSelector))[0].focus();
    await this.page.keyboard.type(authCode);

    await this.page.waitForXPath(authCodeContinueButtonSelector);
    await (await this.page.$x(authCodeContinueButtonSelector))[0].click();

    await this.page.waitForXPath(authCodeContinueButtonSelector);
    await (await this.page.$x(authCodeContinueButtonSelector))[0].click();

    do {
      await this.page.waitForNavigation({ timeout: 10000000 });
      const u = new URL(this.page.url());
      if (u.pathname === '/') {
        break;
      }

      await this.page.waitForXPath(authCodeContinueButtonSelector);
      await (await this.page.$x(authCodeContinueButtonSelector))[0].click();
    } while (this.page.url() !== this.url && this.page.url() !== this.altUrl);

    const cookies = await this.handleCookies();
    await this.page.goto('about:blank');
    return cookies;
  }

  /**
   * Function handles cookies
   * @param save Save cookies to cookiesFile. Defaults to `true`
   * @private
   */
  private async handleCookies(save: boolean = true) {
    const cookies = await this.page.cookies();
    if (this.options.cookiesFile && save) {
      fs.writeFileSync(
        `./${this.options.cookiesFile}`,
        JSON.stringify(cookies, undefined, 4),
        { encoding: 'utf8' },
      );
    }
    return JSON.stringify(cookies);
  }
}
