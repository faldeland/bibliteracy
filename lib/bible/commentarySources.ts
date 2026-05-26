/** Commentary source ids accepted by `/api/bible/commentary`. */
export const HELLOAO_JFB_SOURCE_ID = "jamieson-fausset-brown";
export const BOLLS_NET_SOURCE_ID = "bolls-net";

export const DEFAULT_COMMENTARY_SOURCE_ID = HELLOAO_JFB_SOURCE_ID;

export type CommentaryProvider = "helloao" | "bolls";

export interface CommentarySource {
  id: string;
  provider: CommentaryProvider;
  label: string;
  attributionLabel: string;
  attributionUrl: string;
  /** Bolls translation slug (e.g. NET, NKJV). */
  bollsTranslationId?: string;
  /** helloao.org commentary slug. */
  helloaoCommentaryId?: string;
}

export const COMMENTARY_SOURCES: CommentarySource[] = [
  {
    id: HELLOAO_JFB_SOURCE_ID,
    provider: "helloao",
    label: "Jamieson-Fausset-Brown",
    attributionLabel: "Free Use Bible API",
    attributionUrl: "https://bible.helloao.org/",
    helloaoCommentaryId: HELLOAO_JFB_SOURCE_ID,
  },
  {
    id: BOLLS_NET_SOURCE_ID,
    provider: "bolls",
    label: "NET Bible notes",
    attributionLabel: "Bolls.life Bible API",
    attributionUrl: "https://bolls.life/",
    bollsTranslationId: "NET",
  },
];

export function getCommentarySource(id: string): CommentarySource | undefined {
  return COMMENTARY_SOURCES.find((s) => s.id === id);
}
