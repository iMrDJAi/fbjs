import { BrowserContext, Page } from 'puppeteer';
import Post from '../models/Post';
import Options from '../models/options';
export default class Group {
    options: Options & {
        cookiesFile: string;
    };
    context: BrowserContext;
    page: Page;
    id: string;
    sort?: string;
    get url(): string;
    name: string;
    stopped: boolean;
    constructor(options: Options & {
        cookiesFile: string;
    }, context: BrowserContext, id: string, sort?: string);
    getPosts(callback: (arg0: Post | null) => void, outputFile: string | true, disableAssets?: boolean): Promise<void>;
    private parsePost;
    stop(): Promise<boolean>;
}
