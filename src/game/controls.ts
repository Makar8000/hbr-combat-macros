import type { Key } from "../platform/keyboard.ts";

/** Keys the game uses. */
export const CONTROLS = {
  confirm: "enter",
  altSkill: "alt",
  overdriveMenu: "o",
  menuDown: "down",
  switchSkill: "tab",
} as const satisfies Record<string, Key>;
