import { Page, BrowserContext, HTTPResponse, ElementHandle } from 'puppeteer';
import Post from '../models/Post';
import Options from '../models/options';
export declare function generateFacebookGroupURLById(id: string, sort?: string): string;
export declare function getOldPublications(fileName: string): Post[];
export declare function savePost(postData: Post, outputFile: string): void;
export declare function sleep(duration: number): Promise<void>;
export declare function autoScroll(): void;
export declare function promiseTimeout(promise: Promise<any>, time: number): Promise<any>;
export declare function acceptCookies(page: Page): Promise<void>;
export declare function disableAssetsLoad(page: Page): Promise<void>;
export declare function blankTab(context: BrowserContext, options?: Options & {
    cookiesFile: string;
}): Promise<Page | undefined>;
export declare function checkLoginStatus(res: HTTPResponse): Promise<boolean>;
export declare function selectHnd(parent: ElementHandle | Page, selector: string): Promise<ElementHandle | null>;
export declare function decodeURL(fbUrl: string | null): Promise<string | null>;
