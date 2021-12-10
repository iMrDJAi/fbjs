export default class Selectors {
    static login_form: {
        email: string;
        password: string;
        submit: string;
        parent: string;
    };
    static group: {
        name: string;
        feed: string;
        feed_is_loading: string;
    };
    static post: {
        element: string;
        permalink: string;
        author_name: string;
        author_name_alt: string;
        author_avatar: string;
        content: string;
        readonly txt: string;
        readonly is_txt: string;
        readonly bg: string;
        readonly bg_txt: string;
        see_more: string;
        see_og: string;
        readonly attach: string;
        readonly is_attach: string;
        img: string;
        file: string;
        video: string;
    };
}
