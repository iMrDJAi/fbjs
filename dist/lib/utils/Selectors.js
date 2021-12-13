"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Selectors {
}
exports.default = Selectors;
Selectors.login_form = {
    email: 'input#email',
    password: 'input[type="password"]',
    submit: 'button[data-testid="royal_login_button"]',
    parent: 'form',
};
Selectors.group = {
    name: 'h1[dir=auto] span[dir=auto]',
    feed: 'div[role=feed]',
    feed_is_loading: 'div[role=progressbar]',
};
Selectors.post = {
    element: 'div[role=article][aria-labelledby]',
    permalink: 'span[dir=auto] > span a',
    author_name: ':is(h2, h3, h4) span a',
    author_name_alt: ':is(h2, h3, h4) strong',
    author_avatar: 'svg image',
    content: 'div:not([class]) > div:not([class]):nth-child(3)',
    get txt() { return `${this.content}> div:first-child`; },
    get is_txt() { return `${this.txt}> div:only-child`; },
    get bg() { return `${this.txt}[class] div[class][style]`; },
    get bg_txt() { return `${this.bg}> div:nth-child(2)`; },
    see_more: 'div[role=button]',
    see_og: 'blockquote span + div[role=button]',
    get attach() { return `${this.content}> div:last-child[class][id]`; },
    get is_attach() { return `${this.attach}> :nth-last-child(2)`; },
    img: 'img',
    file: 'a[aria-label][role=link]',
    video: 'a',
};
