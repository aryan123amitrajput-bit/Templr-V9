export interface TemplateMetadata {
  id: string;
  title: string;
  json_url: string;
  traff_url: string;
  thumbnail: string;
  views: number;
  lastViewed: number; // Timestamp
  hidden: boolean;
  revive: boolean;
}
