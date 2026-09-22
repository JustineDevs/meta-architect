import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import type { MDXComponents } from "mdx/types";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getMdxComponents } from "@/components/mdx-components";
import { source } from "@/lib/source";

type PageData = {
  body: (props: { components: MDXComponents }) => ReactNode;
  toc: Array<{ depth: number; title: string; url: string }>;
  title: string;
  description?: string;
};

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug ?? []) as unknown as { data: PageData } | undefined;
  if (!page) notFound();

  const { data } = page;
  const MDX = data.body;
  return (
    <DocsPage toc={data.toc} tableOfContent={{ enabled: data.toc.length > 0 }}>
      <DocsTitle>{data.title}</DocsTitle>
      <DocsDescription>{data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMdxComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug ?? []) as unknown as
    | { data: Pick<PageData, "title" | "description"> }
    | undefined;
  if (!page) return {};
  return { title: page.data.title, description: page.data.description };
}
