import {
  BadgeCheck,
  CalendarDays,
  Hash,
  Link2,
  Paperclip,
  Radio,
  Rows3,
  SquareCheck,
  Star,
  TextCursorInput,
  Type,
  type LucideIcon,
} from "lucide-react";

import type { BuilderBlock } from "@/lib/form-types";

export type BlockType = BuilderBlock["type"];

export const blockIcons: Record<BlockType, LucideIcon> = {
  TEXT: Type,
  SHORT_TEXT: TextCursorInput,
  LONG_TEXT: Rows3,
  SINGLE_CHOICE: Radio,
  MULTIPLE_CHOICE: SquareCheck,
  NUMBER: Hash,
  LINK: Link2,
  AGREEMENT: BadgeCheck,
  DATE: CalendarDays,
  RATING: Star,
  FILE_UPLOAD: Paperclip,
};

export const blockCreationOrder: BlockType[] = [
  "TEXT",
  "SHORT_TEXT",
  "LONG_TEXT",
  "NUMBER",
  "LINK",
  "DATE",
  "RATING",
  "FILE_UPLOAD",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "AGREEMENT",
];
