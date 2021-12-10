"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer_1 = __importDefault(require("puppeteer"));
const login_1 = __importDefault(require("./login"));
const group_1 = __importDefault(require("./group"));
const fb_helpers_1 = require("../utils/fb_helpers");
class Facebook {
    constructor(options, browser) {
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
        this.options = Object.assign(Object.assign(Object.assign({}, defaults), options), { cookiesFile });
        this.browser = browser;
        this.context = null;
    }
    async init() {
        const browser = this.browser || await this.launchBrowser();
        const incognitoContext = await browser.createIncognitoBrowserContext();
        this.context = incognitoContext;
        await fb_helpers_1.blankTab(incognitoContext, this.options);
        const defaultBrowserContext = this.browser.defaultBrowserContext();
        const tab = await fb_helpers_1.blankTab(defaultBrowserContext);
        if (tab) {
            tab.close();
        }
        return this;
    }
    async launchBrowser() {
        var _a, _b;
        const browserOptions = {
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
        };
        if (this.options.maximized && !this.options.headless) {
            (_a = browserOptions.args) === null || _a === void 0 ? void 0 : _a.push('--start-maximized');
        }
        else {
            (_b = browserOptions.args) === null || _b === void 0 ? void 0 : _b.push(`--window-size=${this.options.width},${this.options.height}`);
        }
        if (process.arch === 'arm' || process.arch === 'arm64') {
            browserOptions.executablePath = 'chromium-browser';
        }
        this.browser = await puppeteer_1.default.launch(browserOptions);
        return this.browser;
    }
    close(contextOnly = false) {
        var _a, _b;
        if (contextOnly) {
            (_a = this.context) === null || _a === void 0 ? void 0 : _a.close();
        }
        else {
            (_b = this.browser) === null || _b === void 0 ? void 0 : _b.close();
        }
    }
    login() {
        return new login_1.default(this.options, this.context);
    }
    group(id, sort) {
        return new group_1.default(this.options, this.context, id, sort);
    }
}
exports.default = Facebook;
