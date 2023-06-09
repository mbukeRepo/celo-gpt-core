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
4. Vector embeddings and databases.
5. Generating and storing embeddings.
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

About scaping the markdown files and generating pages and associated sections I'm not going to go into details for the sake of time, but for now just know that we have these functions in the script:

- walk: recursively go through the data folder and reads the files and return the array of files in data folder.

- processMdxForSearch: Processes MDX content for search indexing. It strips all JSX, and splits it into sub-sections based on criteria using `splitTreeBy` function.

### 4. Vector embeddings and databases.

---

In this section we are going to see the high level overview of vector embedding and database which made celo-gpt successful.

#### 4.1. Vector embeddings

Classifying complex data with traditional databases built with structured data may be insufficient. Fortunately, Machine Learning (ML) techniques can offer a far more helpful representation of complex data by transforming it into vector embeddings.
Vector embeddings are used to describe complex data
objects as numeric values in hundreds or thousands of different dimensions.

When data is represented as a vector, it can be used to perform a variety of tasks, including:

- **Similarity search**: Finding similar data objects to a given query object.
- **Classification**: Classifying data objects into categories.
- **Clustering**: Grouping data objects into clusters based on their similarity.
- **Dimensionality reduction**: Reducing the number of dimensions in a data object.
- **Feature extraction**: Extracting features from a data object.

When data is represented as a vector, data with similar characteristics will be close to each other in vector space. This means that we can use vector embeddings to find similar data objects to a given query object.

![representation of data in vectors](https://raw.githubusercontent.com/mbukeRepo/celo-gpt-core/main/images/vector%20embeddings.jpeg)

#### 4.2. Vector databases.

A vector database indexes and stores vector embeddings for fast retrieval and similarity search.

In this tutorial we are going to use [supabase](https://supabase.io/) as our database. By default supabase uses postgresql as its database. To turn it to a vector database, we are going to use the [pg-vector](https://github.com/pgvector/pgvector) extension to store our vector embeddings. The pg-vector extension is a postgresql extension that provides a vector data type and a set of functions for vector operations. The `vector` data type is a fixed-length array of double-precision floating-point numbers. The vector data type is used to store vector embeddings.

`pg-vector` extension give us the ability to store vector embeddings and it comes with a set of functions for vector operations which we are going to use to perform similarity search.
In this tutorial we are going to use inner product operator to perform similarity search. The inner product operator is used to calculate the similarity between two vectors. The inner product operator is denoted by `<#>`.

### 5. Generating and storing vector embeddings.

---

In this section we are going to see how we can generate and store vector embeddings for our knowledge base. We are going to use [text-embedding-ada-002](https://openai.com/blog/new-and-improved-embedding-model) model from `openai` to generate high dimension vector embeddings for our knowledge base. We are going to use `supabase` to store those high dimension vector embeddings.

This is the high level overview of the process.

![Structure of our program](https://raw.githubusercontent.com/mbukeRepo/celo-gpt-core/main/images/celo-gpt.jpeg)

We are going to create a new file called `vectorize.ts` in the `src/scripts` directory which contains module to generate and store vector embeddings. Here is the code for the [file](/src/scripts/vectorize.ts).

About generating and storing vector embeddings I'm not going to go into details for the sake of time, but for now just know that we have these function in the script:

- **generateEmbeddings**: Generates vector embeddings for the knowledge base. Then it stores the embeddings in the database.
