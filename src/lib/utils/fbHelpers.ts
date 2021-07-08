import fs from 'fs';
import GroupPost from '../models/groupPost';

export function generateFacebookGroupURLById(id: number): string {
  return `https://www.facebook.com/groups/${id}/`;
}
/**
 * Function gets old publications.
 * @namespace getOldPublications
 * @param {type} fileName name of the file
 * @return {Object[]} returns the list of all publications.
 * */
export function getOldPublications(fileName: string): GroupPost[] {
  let allPublicationsList;
  if (fs.existsSync(fileName)) {
    // If file exists
    allPublicationsList = JSON.parse(
      fs.readFileSync(fileName, { encoding: 'utf8' }),
    );
  } else {
    // If file does not exists
    allPublicationsList = [];
  }
  return allPublicationsList;
}

/**
 * Function pauses the main execution for given number of seconds
 * @param duration The sleep duration
 */
export async function sleep(duration: number): Promise<void> {
  return new Promise(((resolve) => {
    setTimeout(resolve, duration);
  }));
}

/**
 * Function automatically scrolls
 */
export function autoScroll(): void {
  return window.scrollBy(0, document.body.scrollHeight);
}

/**
 * Function to add timeout to a promise
 * @param promise
 * @param time in ms
 */
export function promiseTimeout(promise: Promise<any>, time: number): Promise<any> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise((_res, rej) => {
      timer = setTimeout(() => rej(new Error('Timeout error!')), time);
    }),
  ]).finally(() => clearTimeout(timer));
}
