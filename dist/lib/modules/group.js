"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fb_helpers_1 = require("../utils/fb_helpers");
const Selectors_1 = __importDefault(require("../utils/Selectors"));
const selectors = JSON.parse(JSON.stringify(Object.assign({}, Selectors_1.default)));
class Group {
    constructor(options, context, id, sort) {
        this.stopped = false;
        this.options = options;
        this.context = context;
        this.page = null;
        this.id = id;
        this.sort = sort;
    }
    get url() {
        return (0, fb_helpers_1.generateFacebookGroupURLById)(this.id, this.sort);
    }
    async getPosts(callback, outputFile, disableAssets = true) {
        this.stopped = false;
        let outputFileName = outputFile === true ? `${this.id}.json` : outputFile;
        outputFileName = outputFileName ? `${outputFileName.replace(/\.json$/g, '')}.json` : outputFileName;
        this.page = this.page || (await (0, fb_helpers_1.blankTab)(this.context, this.options));
        await this.page.goto(this.url, {
            timeout: 600000,
        });
        if (disableAssets) {
            await (0, fb_helpers_1.disableAssetsLoad)(this.page);
        }
        await this.page.waitForSelector(Selectors_1.default.group.name);
        const groupNameElm = await this.page.$(Selectors_1.default.group.name);
        const groupName = await this.page.evaluate((el) => el.textContent, groupNameElm);
        console.log(groupName);
        this.page.evaluate(fb_helpers_1.autoScroll);
        await this.page.waitForSelector(Selectors_1.default.group.feed);
        const feed = (await this.page.$(Selectors_1.default.group.feed));
        let busy = false;
        const handlePosts = async (force) => {
            var _a;
            if (this.stopped) {
                await this.page.goto('about:blank');
                return;
            }
            if (busy && !force)
                return;
            busy = true;
            const postHnd = await ((_a = this.page) === null || _a === void 0 ? void 0 : _a.evaluateHandle(() => window.posts.shift()));
            if ((postHnd === null || postHnd === void 0 ? void 0 : postHnd.toString()) !== 'JSHandle:undefined') {
                const postData = await this.parsePost(postHnd);
                if (callback)
                    callback(postData);
                if (outputFileName)
                    (0, fb_helpers_1.savePost)(postData, outputFileName);
                handlePosts(true);
            }
            else {
                busy = false;
                this.page.evaluate(fb_helpers_1.autoScroll);
                const isLoading = await (0, fb_helpers_1.selectHnd)(feed, Selectors_1.default.group.feed_is_loading);
                if (!isLoading) {
                    this.stop();
                    await handlePosts(true);
                    if (callback)
                        callback(null);
                }
            }
        };
        this.page.exposeFunction('handlePosts', handlePosts);
        const listen = (target, sel) => {
            window.posts = Array.from(target.querySelectorAll(sel.post.element));
            const observer = new MutationObserver((mutations) => {
                for (let i = 0; i < mutations.length; i += 1) {
                    for (let j = 0; j < mutations[i].addedNodes.length; j += 1) {
                        const addedNode = mutations[i].addedNodes[j];
                        const postElm = addedNode.querySelector(sel.post.element);
                        if (postElm) {
                            window.posts.push(postElm);
                            handlePosts(false);
                        }
                    }
                }
            });
            observer.observe(target, { childList: true });
        };
        this.page.evaluate(listen, feed, selectors);
    }
    async parsePost(postHnd) {
        const getPostMetadata = async () => {
            var _a, _b;
            let date, timestamp, permalink, id;
            const postLink = (await postHnd.$(Selectors_1.default.post.permalink));
            try {
                await (0, fb_helpers_1.promiseTimeout)((_a = this.page) === null || _a === void 0 ? void 0 : _a.mouse.move(0, 0), 200);
            }
            catch (err) {
                console.error('Move: ', err.message);
                return await getPostMetadata();
            }
            try {
                await this.page.evaluate((el) => {
                    el.scrollIntoView({ block: 'center', inline: 'nearest' });
                }, postLink);
            }
            catch (err) {
                console.error('Scroll: ', err.message);
                return await getPostMetadata();
            }
            try {
                await (0, fb_helpers_1.promiseTimeout)(postLink.hover(), 500);
            }
            catch (err) {
                console.error('Hover: ', err.message);
                if (err.message === 'Node is either not visible or not an HTMLElement') {
                    await new Promise((res) => setTimeout(res, 1000));
                }
                return await getPostMetadata();
            }
            try {
                await this.page.waitForFunction((el) => {
                    const span = el.parentElement;
                    return span.getAttribute('aria-describedby') !== null;
                }, { timeout: 800 }, postLink);
            }
            catch (err) {
                console.error('Tooltip: ', err.message);
                return await getPostMetadata();
            }
            try {
                date = await this.page.evaluate((el) => {
                    const span = el.parentElement;
                    const tooltipID = span.getAttribute('aria-describedby');
                    const tooltip = document.getElementById(tooltipID);
                    if (!tooltip) {
                        throw new Error('Tooltip not found!');
                    }
                    return tooltip.innerText;
                }, postLink);
                date = date.replace('at ', '');
            }
            catch (err) {
                console.error('Date: ', err.message);
                return await getPostMetadata();
            }
            timestamp = +date;
            try {
                permalink = await this.page.evaluate((el) => el.getAttribute('href').replace(/(\/\?.+)$/, ''), postLink);
            }
            catch (err) {
                console.error('Permalink: ', err.message);
                return await getPostMetadata();
            }
            id = permalink.replace(/^.+\//, '');
            try {
                await (0, fb_helpers_1.promiseTimeout)((_b = this.page) === null || _b === void 0 ? void 0 : _b.mouse.move(0, 0), 200);
            }
            catch (err) {
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
        const getPostAuthor = async (postElm, sel) => {
            let authorName, authorUrl, authorAvatar, activity;
            let authorElm = postElm.querySelector(sel.post.author_name);
            if (authorElm) {
                authorName = authorElm.innerText;
                authorUrl = authorElm.getAttribute('href').replace(/(\/?\?.+)$/, '');
            }
            else {
                authorElm = postElm.querySelector(sel.post.author_name_alt);
                authorName = authorElm.innerText;
                authorUrl = null;
            }
            const authorAvatarElm = postElm.querySelector(sel.post.author_avatar);
            if (authorAvatarElm) {
                authorAvatar = authorAvatarElm.getAttribute('xlink:href');
            }
            else {
                authorAvatar = null;
            }
            const activityElm = postElm.querySelector(sel.post.activity);
            const nodes = Array.from(activityElm.childNodes);
            nodes.shift();
            activity = nodes.map((node) => node.textContent).join('') || null;
            return {
                authorName,
                authorUrl,
                authorAvatar,
                activity,
            };
        };
        const postAuthor = await this.page.evaluate(getPostAuthor, postHnd, selectors);
        const getPostContent = async () => {
            let contentText, contentHtml, background, images = [], url = null, file = null;
            let txt = await (0, fb_helpers_1.selectHnd)(postHnd, Selectors_1.default.post.txt);
            const seeOg = await (0, fb_helpers_1.selectHnd)(postHnd, Selectors_1.default.post.see_og);
            if (!txt && seeOg) {
                await seeOg.click();
                await this.page.waitForFunction((el, sel) => !!el.querySelector(sel.post.txt), { timeout: 2000 }, postHnd, selectors);
                txt = await (0, fb_helpers_1.selectHnd)(postHnd, Selectors_1.default.post.txt);
            }
            const isTxt = await (0, fb_helpers_1.selectHnd)(postHnd, Selectors_1.default.post.is_txt);
            const bg = await (0, fb_helpers_1.selectHnd)(postHnd, Selectors_1.default.post.bg);
            const bgTxt = await (0, fb_helpers_1.selectHnd)(postHnd, Selectors_1.default.post.bg_txt);
            if (txt && isTxt) {
                const txtElm = bgTxt || txt;
                if (bg) {
                    const style = await this.page.evaluate((el) => el.getAttribute('style'), bg) || '';
                    const match = style.match(/url\("(.+)"\)/);
                    background = match ? match[1] : null;
                }
                else {
                    background = null;
                }
                const seeMore = await (0, fb_helpers_1.selectHnd)(txtElm, Selectors_1.default.post.see_more);
                if (seeMore) {
                    const textLength = await this.page.evaluate((el) => el.innerText.length, txtElm);
                    await seeMore.click();
                    await this.page.waitForFunction((el, len) => el.innerText.length !== len, { timeout: 2000 }, txtElm, textLength);
                }
                const { innerText, innerHTML } = await this.page.evaluate((el) => ({
                    innerText: el.innerText,
                    innerHTML: el.innerHTML,
                }), txtElm);
                contentText = innerText;
                contentHtml = innerHTML;
            }
            else {
                contentText = null;
                contentHtml = null;
                background = null;
            }
            const attach = await (0, fb_helpers_1.selectHnd)(postHnd, Selectors_1.default.post.attach);
            const isAttach = await (0, fb_helpers_1.selectHnd)(postHnd, Selectors_1.default.post.is_attach);
            if (attach && isAttach) {
                images = await this.page.evaluate((el, sel) => {
                    const imgs = [];
                    const imgElms = Array.from(el.querySelectorAll(sel.post.img));
                    imgElms.forEach((imgElm) => {
                        const src = imgElm.getAttribute('src');
                        imgs.push(src);
                    });
                    return imgs;
                }, attach, selectors);
                url = await this.page.evaluate((el, sel) => {
                    const urlElm = el.querySelector(sel.post.url);
                    if (urlElm) {
                        return urlElm.getAttribute('href');
                    }
                    return null;
                }, attach, selectors);
                (0, fb_helpers_1.decodeURL)(url);
                file = await this.page.evaluate((el, sel) => {
                    const fileElm = el.querySelector(sel.post.file);
                    if (fileElm) {
                        return {
                            name: fileElm.getAttribute('aria-label'),
                            url: fileElm.getAttribute('href'),
                        };
                    }
                    return null;
                }, attach, selectors);
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
        const groupPost = {
            authorName: postAuthor.authorName,
            authorUrl: postAuthor.authorUrl,
            authorAvatar: postAuthor.authorAvatar,
            activity: postAuthor.activity,
            date: postMetadata.date,
            timestamp: postMetadata.timestamp,
            permalink: postMetadata.permalink,
            id: postMetadata.id,
            contentText: postContent.contentText,
            contentHtml: postContent.contentHtml,
            background: postContent.background,
            images: postContent.images,
            url: postContent.url,
            file: postContent.file,
        };
        return groupPost;
    }
    async stop() {
        this.stopped = true;
        try {
            await this.page.waitForNavigation();
            return true;
        }
        catch (_a) {
            return false;
        }
    }
}
exports.default = Group;
