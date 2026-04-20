// Canonical cross-references. Each entry maps one Bible passage to one or
// more other passages that the historic Christian tradition has linked to
// it for theological, narrative, or quotation reasons.
//
// Sources (all public-domain or creative-commons):
//   • Treasury of Scripture Knowledge (R.A. Torrey, 1834) — the standard
//     19th-century reference work, in the public domain. We include only
//     the highest-confidence entries (NT quotations of OT, direct narrative
//     parallels, well-known thematic chains).
//   • UBS Greek New Testament 5th ed. — index of OT quotations & allusions
//     in the NT (the entries we include are unambiguous quotations marked
//     in solid type in UBS5, not allusions).
//   • Synoptic parallels — the standard Aland synopsis, restricted to
//     pericopes attested in at least two of the three Synoptics.
//
// Each cross-reference is structured (book, chapter, verse range) so it
// can be matched back to the parser/formatter without text munging. The
// `category` lets the UI group references ("OT in NT", "Synoptic parallel",
// "Thematic chain", etc.).
//
// This list is intentionally curated for *high signal* rather than
// completeness — every entry below is universally agreed across confessional
// traditions. Tests in tests/bible/crossRefs.test.ts mechanically verify
// that every reference resolves to a real (book, chapter, verse) triple.

import type { BibleRef } from "@/lib/grid/types";

export type XRefCategory =
  | "ot-in-nt"           // explicit NT quotation of an OT passage
  | "synoptic-parallel"  // same pericope across two or three Synoptics
  | "thematic-chain"     // classic doctrinal chain (Romans Road, etc.)
  | "messianic"          // OT prophecy fulfilled in NT
  | "narrative-parallel" // same event recounted twice in the canon
;

export interface CrossReference {
  /** The reference being cross-linked from. */
  from: BibleRef;
  /** The reference(s) it points to. */
  to: BibleRef[];
  category: XRefCategory;
  /** A short, human-readable note about the link. */
  note: string;
}

const x = (
  book: string,
  chapter: number,
  verseStart?: number,
  verseEnd?: number,
): BibleRef => ({ book, chapter, verseStart, verseEnd });

export const CROSS_REFERENCES: CrossReference[] = [
  // ── Christmas / Nativity: Isaiah → Matthew ─────────────────────────────
  {
    from: x("Isa", 7, 14),
    to: [x("Mat", 1, 22, 23)],
    category: "messianic",
    note: "Virgin shall conceive — quoted at Jesus' nativity.",
  },
  {
    from: x("Mat", 1, 22, 23),
    to: [x("Isa", 7, 14)],
    category: "ot-in-nt",
    note: "Matthew's nativity quotes Isaiah 7:14.",
  },
  {
    from: x("Mic", 5, 2),
    to: [x("Mat", 2, 5, 6)],
    category: "messianic",
    note: "Bethlehem prophecy cited by the chief priests to Herod.",
  },
  {
    from: x("Mat", 2, 5, 6),
    to: [x("Mic", 5, 2)],
    category: "ot-in-nt",
    note: "Quotation of Micah 5:2 in the Magi narrative.",
  },

  // ── John the Baptist: Isaiah 40 → all four Gospels ─────────────────────
  {
    from: x("Isa", 40, 3),
    to: [
      x("Mat", 3, 3),
      x("Mrk", 1, 3),
      x("Luk", 3, 4, 6),
      x("Jhn", 1, 23),
    ],
    category: "ot-in-nt",
    note: "Voice crying in the wilderness — applied to John the Baptist in all four Gospels.",
  },

  // ── Sermon on the Mount → Sermon on the Plain ──────────────────────────
  {
    from: x("Mat", 5, 3, 12),
    to: [x("Luk", 6, 20, 26)],
    category: "synoptic-parallel",
    note: "Beatitudes — Matthew's longer form vs. Luke's Sermon on the Plain.",
  },
  {
    from: x("Luk", 6, 20, 26),
    to: [x("Mat", 5, 3, 12)],
    category: "synoptic-parallel",
    note: "Lukan Beatitudes paralleling Matthew 5.",
  },

  // ── Lord's Prayer ──────────────────────────────────────────────────────
  {
    from: x("Mat", 6, 9, 13),
    to: [x("Luk", 11, 2, 4)],
    category: "synoptic-parallel",
    note: "Lord's Prayer — Matthew's liturgical form vs. Luke's shorter form.",
  },
  {
    from: x("Luk", 11, 2, 4),
    to: [x("Mat", 6, 9, 13)],
    category: "synoptic-parallel",
    note: "Lukan Lord's Prayer paralleling Matthew 6.",
  },

  // ── Great Commandment ──────────────────────────────────────────────────
  {
    from: x("Deu", 6, 4, 5),
    to: [
      x("Mat", 22, 37, 38),
      x("Mrk", 12, 29, 30),
      x("Luk", 10, 27),
    ],
    category: "ot-in-nt",
    note: "The Shema — quoted by Jesus as the great commandment.",
  },
  {
    from: x("Lev", 19, 18),
    to: [
      x("Mat", 22, 39),
      x("Mrk", 12, 31),
      x("Luk", 10, 27),
      x("Rom", 13, 9),
      x("Gal", 5, 14),
      x("Jas", 2, 8),
    ],
    category: "ot-in-nt",
    note: "Love your neighbor as yourself — cited six times in the NT.",
  },

  // ── Triumphal Entry ────────────────────────────────────────────────────
  {
    from: x("Zec", 9, 9),
    to: [x("Mat", 21, 5), x("Jhn", 12, 14, 15)],
    category: "messianic",
    note: "King coming on a donkey — fulfilled in the triumphal entry.",
  },

  // ── Crucifixion: Psalm 22 → Passion narratives ─────────────────────────
  {
    from: x("Psa", 22, 1),
    to: [x("Mat", 27, 46), x("Mrk", 15, 34)],
    category: "ot-in-nt",
    note: "\"My God, my God, why hast thou forsaken me?\" — Christ's cry from the cross.",
  },
  {
    from: x("Psa", 22, 18),
    to: [
      x("Mat", 27, 35),
      x("Mrk", 15, 24),
      x("Luk", 23, 34),
      x("Jhn", 19, 23, 24),
    ],
    category: "messianic",
    note: "Casting lots for his garments — fulfilled at the crucifixion.",
  },

  // ── Suffering Servant: Isaiah 53 → NT ──────────────────────────────────
  {
    from: x("Isa", 53),
    to: [
      x("Mat", 8, 17),
      x("Act", 8, 32, 35),
      x("1Pe", 2, 22, 25),
    ],
    category: "messianic",
    note: "The Suffering Servant — applied to Jesus' passion across the NT.",
  },

  // ── Pentecost: Joel 2 → Acts 2 ─────────────────────────────────────────
  {
    from: x("Joe", 2, 28, 32),
    to: [x("Act", 2, 17, 21)],
    category: "ot-in-nt",
    note: "Pouring out of the Spirit — Peter quotes Joel at Pentecost.",
  },
  {
    from: x("Act", 2, 17, 21),
    to: [x("Joe", 2, 28, 32)],
    category: "ot-in-nt",
    note: "Peter's Pentecost sermon quotes Joel 2.",
  },

  // ── Romans Road / Salvation chain ──────────────────────────────────────
  {
    from: x("Rom", 3, 23),
    to: [
      x("Rom", 5, 8),
      x("Rom", 6, 23),
      x("Rom", 10, 9, 10),
      x("Eph", 2, 8, 9),
    ],
    category: "thematic-chain",
    note: "Romans Road — classic salvation chain.",
  },
  {
    from: x("Rom", 6, 23),
    to: [x("Rom", 3, 23), x("Rom", 5, 8), x("Jhn", 3, 16)],
    category: "thematic-chain",
    note: "Wages of sin / gift of God — paired with the gospel summary.",
  },
  {
    from: x("Jhn", 3, 16),
    to: [x("Rom", 5, 8), x("1Jn", 4, 9, 10)],
    category: "thematic-chain",
    note: "God so loved the world — paired with Paul's and John's parallels.",
  },

  // ── Justification by faith ─────────────────────────────────────────────
  {
    from: x("Gen", 15, 6),
    to: [
      x("Rom", 4, 3),
      x("Gal", 3, 6),
      x("Jas", 2, 23),
    ],
    category: "ot-in-nt",
    note: "Abraham believed God — Paul and James both cite this verse.",
  },
  {
    from: x("Hab", 2, 4),
    to: [x("Rom", 1, 17), x("Gal", 3, 11), x("Heb", 10, 38)],
    category: "ot-in-nt",
    note: "The just shall live by faith — quoted three times in the NT.",
  },

  // ── Hebrews 1 catena (chain of OT quotations) ──────────────────────────
  {
    from: x("Psa", 2, 7),
    to: [x("Heb", 1, 5), x("Act", 13, 33), x("Heb", 5, 5)],
    category: "ot-in-nt",
    note: "\"Thou art my Son\" — quoted at Jesus' baptism, resurrection, and high priesthood.",
  },
  {
    from: x("Psa", 110, 1),
    to: [
      x("Mat", 22, 44),
      x("Mrk", 12, 36),
      x("Luk", 20, 42, 43),
      x("Act", 2, 34, 35),
      x("Heb", 1, 13),
    ],
    category: "ot-in-nt",
    note: "Most-quoted OT verse in the NT — Christ's exaltation.",
  },
  {
    from: x("Psa", 110, 4),
    to: [x("Heb", 5, 6), x("Heb", 7, 17), x("Heb", 7, 21)],
    category: "ot-in-nt",
    note: "Priest forever after the order of Melchizedek — central to Hebrews.",
  },

  // ── New Covenant ───────────────────────────────────────────────────────
  {
    from: x("Jer", 31, 31, 34),
    to: [x("Heb", 8, 8, 12), x("Heb", 10, 16, 17)],
    category: "ot-in-nt",
    note: "New covenant prophecy — Hebrews quotes it twice.",
  },

  // ── Resurrection chapter parallels ─────────────────────────────────────
  {
    from: x("1Co", 15, 3, 8),
    to: [
      x("Mat", 28),
      x("Mrk", 16),
      x("Luk", 24),
      x("Jhn", 20),
    ],
    category: "narrative-parallel",
    note: "Paul's resurrection summary — paralleled by all four Gospel accounts.",
  },

  // ── Creation echoes ────────────────────────────────────────────────────
  {
    from: x("Gen", 1, 1),
    to: [x("Jhn", 1, 1, 3), x("Col", 1, 16, 17), x("Heb", 1, 2, 3)],
    category: "thematic-chain",
    note: "In the beginning — creation passages applied to Christ in the NT.",
  },

  // ── Abrahamic blessing → Galatians 3 ───────────────────────────────────
  {
    from: x("Gen", 12, 3),
    to: [x("Gal", 3, 8), x("Act", 3, 25)],
    category: "ot-in-nt",
    note: "All nations blessed in Abraham — fulfilled in the gospel to the Gentiles.",
  },

  // ── Last Supper / Passover ─────────────────────────────────────────────
  {
    from: x("Exo", 12, 1, 14),
    to: [
      x("Mat", 26, 17, 30),
      x("Mrk", 14, 12, 26),
      x("Luk", 22, 7, 23),
      x("1Co", 5, 7),
      x("1Co", 11, 23, 26),
    ],
    category: "thematic-chain",
    note: "Passover institution — fulfilled in the Last Supper and Christ our Passover.",
  },

  // ── 23rd Psalm shepherd imagery ────────────────────────────────────────
  {
    from: x("Psa", 23),
    to: [x("Jhn", 10, 11, 18), x("Heb", 13, 20), x("1Pe", 2, 25)],
    category: "thematic-chain",
    note: "The LORD is my shepherd — Jesus as the Good Shepherd.",
  },

  // ── Servant songs / Holy Communion (1 Cor 11 ↔ Last Supper) ────────────
  {
    from: x("1Co", 11, 23, 26),
    to: [
      x("Mat", 26, 26, 29),
      x("Mrk", 14, 22, 25),
      x("Luk", 22, 14, 20),
    ],
    category: "narrative-parallel",
    note: "Paul's Eucharistic tradition received from the Lord, paralleling the Synoptics.",
  },
];
