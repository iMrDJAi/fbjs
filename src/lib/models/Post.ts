export default interface Post {
  groupName: string | null,
  groupUrl: string | null,
  authorName: string,
  authorUrl: string | null,
  authorGrpPf: string | null,
  authorAvatar: string | null,
  activity: string | null,
  date: string,
  timestamp: number,
  permalink: string,
  id: string,
  contentText: string | null,
  contentHtml: string | null,
  background: string | null,
  images: any[],
  url: string | null,
  file: string | null
}
