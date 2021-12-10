"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectHnd = exports.checkLoginStatus = exports.blankTab = exports.disableAssetsLoad = exports.acceptCookies = exports.promiseTimeout = exports.autoScroll = exports.sleep = exports.savePost = exports.getOldPublications = exports.generateFacebookGroupURLById = void 0;
const fs_1 = __importDefault(require("fs"));
function generateFacebookGroupURLById(id, sort) {
    const url = sort
        ? `https://www.facebook.com/groups/${id}/?sorting_setting=${sort}`
        : `https://www.facebook.com/groups/${id}/`;
    return url;
}
exports.generateFacebookGroupURLById = generateFacebookGroupURLById;
function getOldPublications(fileName) {
    let allPublicationsList;
    if (fs_1.default.existsSync(fileName)) {
        allPublicationsList = JSON.parse(fs_1.default.readFileSync(fileName, { encoding: 'utf8' }));
    }
    else {
        allPublicationsList = [];
    }
    return allPublicationsList;
}
exports.getOldPublications = getOldPublications;
function savePost(postData, outputFile) {
    const allPublicationsList = getOldPublications(outputFile);
    allPublicationsList.push(postData);
    fs_1.default.writeFileSync(`./${outputFile}`, JSON.stringify(allPublicationsList, undefined, 4), { encoding: 'utf8' });
}
exports.savePost = savePost;
async function sleep(duration) {
    return new Promise(((resolve) => {
        setTimeout(resolve, duration);
    }));
}
exports.sleep = sleep;
function autoScroll() {
    return window.scrollBy(0, document.body.scrollHeight);
}
exports.autoScroll = autoScroll;
function promiseTimeout(promise, time) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_res, rej) => {
            timer = setTimeout(() => rej(new Error('Timeout error!')), time);
        }),
    ]).finally(() => clearTimeout(timer));
}
exports.promiseTimeout = promiseTimeout;
async function acceptCookies(page) {
    try {
        await page.waitForXPath('//button[@data-cookiebanner="accept_button"]');
        const acceptCookiesButton = (await page.$x('//button[@data-cookiebanner="accept_button"]'))[0];
        await page.evaluate((el) => {
            el.focus();
            el.click();
        }, acceptCookiesButton);
    }
    catch (_a) {
        (() => { })();
    }
}
exports.acceptCookies = acceptCookies;
async function disableAssetsLoad(page) {
    await page.setRequestInterception(true);
    const blockResources = [
        'image', 'media', 'font', 'textrack', 'object',
        'beacon', 'csp_report', 'imageset',
    ];
    page.on('request', (request) => {
        const rt = request.resourceType();
        if (blockResources.indexOf(rt) > 0
            || request.url()
                .match(/\.((jpe?g)|png|gif)/) != null) {
            request.abort();
        }
        else {
            request.continue();
        }
    });
}
exports.disableAssetsLoad = disableAssetsLoad;
async function blankTab(context, options) {
    const pages = await context.pages();
    let page = pages.find((p) => p.url() === 'about:blank');
    if (!page && options) {
        page = await context.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36');
        let cookiesString;
        if (options.cookiesString) {
            cookiesString = options.cookiesString;
        }
        else if (options.cookiesFile && fs_1.default.existsSync(options.cookiesFile)) {
            cookiesString = fs_1.default.readFileSync(options.cookiesFile);
        }
        if (cookiesString) {
            const cookies = JSON.parse(cookiesString.toString());
            await page.setCookie(...cookies);
        }
    }
    return page;
}
exports.blankTab = blankTab;
async function checkLoginStatus(res) {
    const body = await res.text();
    return !body.includes('<meta name="description"');
}
exports.checkLoginStatus = checkLoginStatus;
async function selectHnd(parent, selector) {
    let hnd;
    try {
        hnd = await parent.$(selector);
    }
    catch (_a) {
        hnd = null;
    }
    return hnd;
}
exports.selectHnd = selectHnd;
