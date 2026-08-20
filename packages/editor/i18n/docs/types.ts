/**
 * Shape of the in-app guide.
 *
 * The guide is long-form teaching, not interface labels, so it lives as a
 * structure instead of a hundred flat message keys: a section is a heading plus
 * blocks, and each locale ships the same sections in the same order. A test
 * checks that parity, because a translated guide that quietly loses a section is
 * worse than one that is obviously missing.
 *
 * Text may carry `<b>` and `<code>`; it is catalogue content, never user input,
 * so it is rendered with `{@html}`.
 */
export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'steps'; items: string[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'keys'; rows: [keys: string, meaning: string][] }
  | { kind: 'note'; text: string }
  /** Code is the same in every language: it is not translated. */
  | { kind: 'code'; code: string };

export interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

export type Guide = Section[];
