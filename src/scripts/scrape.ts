import { createHash } from "crypto";
import { readdir, stat } from "fs/promises";
import { Content, Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { mdxFromMarkdown } from "mdast-util-mdx";
import { toMarkdown } from "mdast-util-to-markdown";
import { mdxjs } from "micromark-extension-mdxjs";
import { join } from "path";
import { u } from "unist-builder";
import { filter } from "unist-util-filter";
import dotenv from "dotenv";

dotenv.config({
  path: "../.env",
});

/**
 * Splits a `mdast` tree into multiple trees based on
 * a predicate function. Will include the splitting node
 * at the beginning of each tree.
 *
 * Useful to split a markdown file into smaller sections.
 */
function splitTreeBy(tree: Root, predicate: (node: Content) => boolean) {
  return tree.children.reduce<Root[]>((trees, node) => {
    const [lastTree] = trees.slice(-1);

    if (!lastTree || predicate(node)) {
      const tree: Root = u("root", [node]);
      return trees.concat(tree);
    }

    lastTree.children.push(node);
    return trees;
  }, []);
}

type ProcessedMdx = {
  checksum: string;
  sections: string[];
};

/**
 * Processes MDX content for search indexing.
 * It extracts metadata, strips it of all JSX,
 * and splits it into sub-sections based on criteria.
 */
export function processMdxForSearch(content: string): ProcessedMdx {
  const checksum = createHash("sha256").update(content).digest("base64");

  const mdxTree = fromMarkdown(content, {
    extensions: [mdxjs()],
    mdastExtensions: [mdxFromMarkdown()],
  });

  // Remove all MDX elements from markdown
  const mdTree = filter(
    mdxTree,
    (node) =>
      ![
        "mdxjsEsm",
        "mdxJsxFlowElement",
        "mdxJsxTextElement",
        "mdxFlowExpression",
        "mdxTextExpression",
      ].includes(node.type)
  );

  if (!mdTree) {
    return {
      checksum,
      sections: [],
    };
  }

  const sectionTrees = splitTreeBy(mdTree, (node) => node.type === "heading");

  const sections = sectionTrees.map((tree) => toMarkdown(tree));

  return {
    checksum,
    sections,
  };
}

export async function walk(dir: string): Promise<string[]> {
  const immediateFiles = await readdir(dir);

  const recursiveFiles = await Promise.all(
    immediateFiles.map(async (file) => {
      const filePath = join(dir, file);
      const stats = await stat(filePath);
      if (stats.isDirectory()) {
        return walk(filePath);
      } else if (stats.isFile()) {
        return [filePath];
      } else {
        return [];
      }
    })
  );

  const flattenedFiles = recursiveFiles.reduce(
    (all, folderContents) => all.concat(folderContents),
    []
  );

  return flattenedFiles;
}
