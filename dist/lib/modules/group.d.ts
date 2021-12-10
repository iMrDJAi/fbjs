import { BrowserContext } from 'puppeteer';
import Post from '../models/Post';
import Options from '../models/options';
export default class Group {
    private options;
    private context;
    private page;
    private id;
    private sort?;
    private get url();
    private stopped;
    constructor(options: Options & {
        cookiesFile: string;
    }, context: BrowserContext, id: string, sort?: string);
    getPosts(callback: (arg0: Post | null) => void, outputFile: string | true, disableAssets?: boolean): Promise<void>;
    private parsePost;
    stop(): Promise<boolean>;
}
