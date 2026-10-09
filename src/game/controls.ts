import type { Key } from "../platform/keyboard.ts";

/** In-game key bindings. */
export const CONTROLS = {
  confirm: "enter",
  altSkill: "alt",
  overdriveMenu: "o",
  menuDown: "down",
  menuTab: "tab",
} as const satisfies Record<string, Key>;
