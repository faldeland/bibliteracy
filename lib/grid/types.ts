export type DotKind = "logos" | "prayer" | "discipleship";
export type DotVisibility = "private" | "guests" | "public";
export type LogosTag = "logos" | "rhema" | "both";

export interface BibleRef {
  book: string; // canonical book id, see lib/bible/books.ts
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}

export interface Attachment {
  id: string;
  kind: "image" | "video" | "audio" | "link" | "pdf";
  url: string;
  meta?: Record<string, unknown>;
}

export interface Dot {
  id: string;
  ownerId: string;
  kind: DotKind;
  /**
   * Which lane (timeline row) this dot lives on. Null for legacy dots created
   * before timelines existed — those fall back to their `kind`'s built-in
   * timeline at the query layer.
   */
  timelineId?: string | null;
  /** YYYY-MM-DD in the owner's local time. */
  occurredOn: string;
  title?: string;
  bodyMd?: string;
  refs: BibleRef[];
  /** Free-form user tags (lowercased on write, unique). */
  tags: string[];
  /** Only meaningful for kind === "logos" */
  logosTag?: LogosTag;
  visibility: DotVisibility;
  livekitRoomName?: string;
  scheduledFor?: string;
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}
