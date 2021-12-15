"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const two_fa_required_error_1 = __importDefault(require("../errors/two_fa_required_error"));
const fb_helpers_1 = require("../utils/fb_helpers");
const Selectors_1 = __importDefault(require("../utils/Selectors"));
class Login {
    constructor(options, context) {
        this.url = 'https://www.facebook.com';
        this.altUrl = 'https://facebook.com';
        this.options = options;
        this.context = context;
        this.page = null;
    }
    async login(credentials) {
        this.page = (await (0, fb_helpers_1.blankTab)(this.context, this.options));
        const res = await this.page.goto(this.url);
        const isLoggedIn = await (0, fb_helpers_1.checkLoginStatus)(res);
        if (isLoggedIn || !credentials) {
            const cookies = isLoggedIn ? await this.handleCookies(false) : null;
            await this.page.goto('about:blank');
            return cookies;
        }
        await (0, fb_helpers_1.acceptCookies)(this.page);
        await this.completeLoginForm(credentials.username, credentials.password);
        if (await this.checkFor2FA()) {
            throw new two_fa_required_error_1.default();
        }
        await this.page.waitForXPath('//div[@data-pagelet="Stories"]');
        const cookies = await this.handleCookies();
        await this.page.goto('about:blank');
        return cookies;
    }
    async completeLoginForm(username, password) {
        await this.page.waitForSelector(Selectors_1.default.login_form.parent);
        await this.page.focus(Selectors_1.default.login_form.email);
        await this.page.keyboard.type(username);
        await this.page.focus(Selectors_1.default.login_form.password);
        await this.page.keyboard.type(password);
        await this.page.waitForXPath('//button[@data-testid="royal_login_button"]');
        const [loginButton] = await this.page.$x('//button[@data-testid="royal_login_button"]');
        await loginButton.click();
    }
    async checkFor2FA() {
        try {
            await this.page.waitForXPath('//form[contains(concat(" ", normalize-space(@class), " "), " checkpoint")]');
            return true;
        }
        catch (e) {
            return false;
        }
    }
    async enterAuthCode(authCode) {
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
    async handleCookies(save = true) {
        const cookies = await this.page.cookies();
        if (this.options.cookiesFile && save) {
            fs_1.default.writeFileSync(`./${this.options.cookiesFile}`, JSON.stringify(cookies, undefined, 4), { encoding: 'utf8' });
        }
        return JSON.stringify(cookies);
    }
}
exports.default = Login;
