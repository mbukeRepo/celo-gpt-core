## Connecting large knowledge bases with chat-gpt using context injection

In this tutorial, we are going to see how you can connect a large knowledge base with chat-gpt to perform semantic search over our knowledge base. Semantic search is a type of seaching where the search results are based on the meaning of the search query. For example, if you search for "How to buy Celo Gold", the search results should be relevant to the query and not just the words in the query. In this tutorial we are going to use [celo](https://celo.org/) as our knowlege base.

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) make sure to have node.js v16 and above.

- [Supabase CLI](https://www.npmjs.com/package/supabase) make sure you have Supabase CLI installed.

- [Supabase account](https://supabase.io/) make sure you have a supabase account.

- [OpenAI API key](https://beta.openai.com/) make sure you have an openai api key.

- [Celo docs](https://docs.celo.org/) make sure you have the celo docs cloned locally. You can download the celo docs folder with markdown files using this [tool](https://download-directory.github.io/)

- [Git](https://git-scm.com/downloads) make sure you have git installed.

### Overview

This project have five parts:

1. Project setup.
2. Creating a supabase database.
3. Scraping the markdown files.
4. Vector database and embeddings.
5. Generating embeddings.
6. Prompt engineering.
7. Connecting the knowledge base with chat-gpt.

### 1. Project setup

---

First, we need to setup our project. We are going to use [supabase](https://supabase.io/) as our database and [openai](https://beta.openai.com/) as our machine learning model for searching and generating embeddings. This project will be built using Typescript follow these steps to create a new project using Typescript.

```bash
$ git clone https://github.com/mbukeRepo/typescript-node-starter.git
$ cd typescript-node-starter
$ npm install
```

If you are not logged into `supabase` run this command to login.

```bash
$ supabase login # or npx supabase login
```

Then you have to initialize a new supabase project. You can do this by running this command.

```bash
$ supabase init # or npx supabase init
```

After that link this directory to your supabase project.

```bash
$ supabase link --project-ref <project-id> # or npx supabase link --project-ref <project-id>
```

#### 1.1. Installing dependencies

In this project we are going to use these core packages: `openai` sdk to generate embeddings, `@supabase/supabase-js` sdk to connect to our database, `dotenv` to work with environment variables.

```bash
$ npm install openai @supabase/supabase-js dotenv
```

#### 1.2. Creating environment variables

We are going to use environment variables to store our sensitive information like our openai api key and our supabase url. Create a new file called `.env` in the root directory of your project and add the following variables.

```bash
OPENAI_API_KEY=<your-openai-api-key>
SUPABASE_URL=<your-supabase-url>
SUPABASE_KEY=<your-supabase-key>
```

### 1.3. Folder structure and files structure

We are going to use the following folder structure for our project.

```bash
.
├── src
│   ├── supabase
|   |   ├── .gitignore
|   |   ├── seed.sql
|   |   ├── config.toml
│   │   └── migrations
│   │       └── 1634040000000_init.sql
│   ├── index.ts
│   ├── scripts
│   │   ├── index.ts
│   │   ├── scrape.ts
│   │   └── vectorize.ts
├── .env
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
├── tsconfig.json
```

### 2. Creating a supabase database

---

We are going to use supabase as our database.

To get started, generate a new migration to store the SQL needed to create our tables.

```bash
$ supabase migrate new <migration-name> # or npx supabase migrate new <migration-name>
```

We are going to be using two core tables called `pages` and `page_sections`.
Here are the schemas for the tables. The `page_sections` table will store the embeddings for each section in the markdown files. We will talk about embeddings later for now just know that we are going to use them to search our knowledge base. To be able to store the embeddings we are going to use the `vector` data type. To be able to use the `vector` data type we need to install the [pg-vector](https://github.com/pgvector/pgvector) extension. Here is the SQL for the tables.

```sql
create extension if not exists vector with schema public;

create table "public"."page" (
  id bigserial primary key,
  path text not null unique,
  checksum text
);

create table "public"."page_section" (
  id bigserial primary key,
  page_id bigint not null references public.page on delete cascade,
  content text,
  token_count int,
  embedding vector(1536)
);
```

Deploy the database migrations to the remote database.

```bash
$ supabase db push # or npx supabase db push
```

**NOTE**: To activate the `vector` extension, go to database section in your supabase dashboard and click on the `Extensions` tab. Then search for `vector` extension the activate this by toggling the switch.

### 3. Scraping the markdown files

---

We are going to use the [celo docs](https://docs.celo.org/) as our knowledge base. We are going to scrape the markdown files and store them in our database. To do this we are going to use the [supabase-js](https://www.npmjs.com/package/@supabase/supabase-js) sdk.

First we have to first download the celo docs folder with markdown files using this [tool](https://download-directory.github.io/). Here is the link to the exact path with docs in markdown format: [here](https://github.com/celo-org/docs/tree/main/docs)

After downloading the docs folder you can copy that data in `src/data` folder. We are going to create a new file called `scrape.ts` in the `src/scripts` directory which contains module to scrape the markdown files. Here is the code for the file.

First thing first we need to be able to recursively scrape the markdown files. Here is the script for that. For the sake of time I'm not going to explain the code in detail.

```ts
async function walk(dir: string): Promise<string[]> {
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
```

Then we need to process the markdown files and generate sections off of the files. Here we are going to use the `mdast` library to parse the markdown files and generate sections. Here is the code for that.

```ts
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

/**
 * Processes MDX content for search indexing.
 * It extracts metadata, strips it of all JSX,
 * and splits it into sub-sections based on criteria.
 */
function processMdxForSearch(content: string): ProcessedMdx {
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
```
