export interface ChannelDefinition {
  slug: string;
  name: string;
  description: string;
  sourceUrl: string;
}

export interface ArticleItem {
  id: string;
  title: string;
  link: string;
  channelSlug: string;
  channelName: string;
  source: string;
  editor: string;
  publishedAt: string;
  pubDateDisplay: string;
  dateKey?: string;
  summary: string;
  paragraphs: string[];
  images: string[];
}

export interface DailyEdition {
  date: string;
  dateDisplay: string;
  weekday: string;
  editionTitle: string;
  link: string;
  publishedAt: string;
  articleCount: number;
  channelsCovered: string[];
  leadImage?: string;
  summary: string;
  articles: ArticleItem[];
}

export interface ArticlesApiResponse {
  channel: ChannelDefinition;
  fetchedAt: string;
  fromCache: boolean;
  total: number;
  items: ArticleItem[];
}

export interface DailyApiResponse {
  fetchedAt: string;
  fromCache: boolean;
  totalEditions: number;
  editions: DailyEdition[];
}

export type FeedFormat = "rss" | "atom" | "json";
export type SubscriptionMode = "daily" | "channels";
