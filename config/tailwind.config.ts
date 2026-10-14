import type { Config } from "tailwindcss";

const spacingSteps = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20,
  24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96,
] as const;

const spacing = Object.fromEntries(
  spacingSteps.map((step) => [
    String(step),
    `calc(var(--spacing-base) * ${step})`,
  ]),
);

const config: Config = {
  content: ["../src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      background: "var(--background)",
      foreground: "var(--foreground)",
      border: "var(--border)",
      input: "var(--input)",
      card: "var(--card)",
      "card-foreground": "var(--card-foreground)",
      sidebar: "var(--sidebar)",
      popover: "var(--popover)",
      "popover-foreground": "var(--popover-foreground)",
      primary: {
        DEFAULT: "var(--primary)",
        foreground: "var(--primary-foreground)",
      },
      ring: "var(--ring)",
      secondary: {
        DEFAULT: "var(--secondary)",
        foreground: "var(--secondary-foreground)",
      },
      muted: {
        DEFAULT: "var(--muted)",
        foreground: "var(--muted-foreground)",
      },
      accent: {
        DEFAULT: "var(--accent)",
        foreground: "var(--accent-foreground)",
      },
      destructive: {
        DEFAULT: "var(--destructive)",
        foreground: "var(--destructive-foreground)",
      },
      danger: "var(--danger)",
      warning: {
        DEFAULT: "var(--warning)",
        foreground: "var(--warning-foreground)",
      },
      success: {
        DEFAULT: "var(--success)",
        foreground: "var(--success-foreground)",
      },
      "brand-text": "var(--brand-text)",
      link: "var(--link)",
      chart: {
        1: "var(--chart-1)",
        2: "var(--chart-2)",
        3: "var(--chart-3)",
        4: "var(--chart-4)",
        5: "var(--chart-5)",
      },
    },
    spacing,
    borderRadius: {
      none: "0",
      DEFAULT: "var(--radius)",
      button: "var(--radius-button)",
      input: "var(--radius-input)",
      card: "var(--radius-card)",
      full: "9999px",
    },
    fontFamily: {
      sans: "var(--font-sans)",
      heading: "var(--font-heading)",
      "heading-wide": "var(--font-heading-wide)",
      mono: "var(--font-mono)",
    },
  },
};

export default config;
