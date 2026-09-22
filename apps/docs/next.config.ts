import { resolve } from "node:path";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const config = {
  reactStrictMode: true,
  transpilePackages: ["fumadocs-ui"],
  turbopack: {
    root: resolve(process.cwd()),
  },
};

export default withMDX(config);
