import { Browser } from 'puppeteer';
import Options from '../models/options';
import Login from './login';
import Group from './group';
declare global {
    interface Window {
        posts: HTMLElement[];
    }
}
export default class Facebook {
    private options;
    private browser;
    private context;
    constructor(options: Options, browser: Browser);
    init(): Promise<Facebook>;
    launchBrowser(): Promise<Browser>;
    close(contextOnly?: boolean): void;
    login(): Login;
    group(id: string, sort?: string): Group;
}
