
export type Theme = 'light' | 'dark';

export interface Book {
  title: string;
  pages: string[];
}

export interface AudioSegment {
  id: string;
  text: string;
  audio: AudioBuffer;
  pageRange: { from: number; to: number };
}
