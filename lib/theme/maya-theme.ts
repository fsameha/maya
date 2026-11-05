import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";

// Astryx theme for Maya (PRD §3): one accent, pills, borders over shadows.
export const mayaTheme = defineTheme({
  name: "maya",
  extends: neutralTheme,
  typography: {
    body: { family: "var(--font-inter)", fallbacks: "system-ui, sans-serif" },
    heading: { family: "var(--font-montserrat)", fallbacks: "system-ui, sans-serif" },
    code: { family: "var(--font-jetbrains)", fallbacks: "ui-monospace, monospace" },
  },
  tokens: {
    "--color-accent": ["#0064e0", "#2d8cff"],
    "--color-background-body": ["#ffffff", "#0a1317"],
    "--color-background-surface": ["#f1f4f7", "#141c21"],
    "--color-border": ["#dee3e9", "#26313a"],
    "--color-border-emphasized": ["#ced0d4", "#3a4650"],
    "--color-text-primary": ["#1c1e21", "#e4e6eb"],
    "--color-text-secondary": ["#5d6c7b", "#9aa6b2"],
  },
  components: {
    button: { base: { borderRadius: "999px", "--button-focus-offset": "3px" } },
    badge: { base: { borderRadius: "999px" } },
  },
});
