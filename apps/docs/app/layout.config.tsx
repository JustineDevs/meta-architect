import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Meta-Architect",
      url: "/docs",
    },
    links: [
      { text: "Guides", url: "/docs/getting-started" },
      { text: "Reference", url: "/docs/reference/cli" },
      { text: "GitHub", url: "https://github.com/JustineDevs/meta-architect" },
    ],
  };
}
