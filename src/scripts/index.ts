import { generateEmbeddings } from "./vectorize";
async function main() {
  await generateEmbeddings();
}

main().catch((err) => console.error(err));
