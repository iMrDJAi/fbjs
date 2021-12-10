import { BrowserContext } from 'puppeteer';
import Credentials from '../models/credentials';
import Options from '../models/options';
export default class Login {
    private url;
    private altUrl;
    private options;
    private context;
    private page;
    constructor(options: Options & {
        cookiesFile: string;
    }, context: BrowserContext);
    login(credentials?: Credentials): Promise<string | null>;
    private completeLoginForm;
    private checkFor2FA;
    enterAuthCode(authCode: string): Promise<string>;
    private handleCookies;
}
