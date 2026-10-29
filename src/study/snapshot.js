import tags from "../data/tags.json";
import partsOfSpeech from "../data/partsOfSpeech.json";
import { createGlossary } from "./glossary.mjs";

const categoryFiles = import.meta.glob("../data/categories*", {
  eager: true, query: "?raw", import: "default",
});
const entryFiles = import.meta.glob("../data/glossary/*.json", { eager: true, import: "default" });

export function getBundledGlossary() {
  const source = categoryFiles["../data/categories.json"] ?? categoryFiles["../data/categories,json"];
  if (!source) throw new Error("Falta la configuració de categories.");
  return createGlossary({
    categories: JSON.parse(source.replace(/^\uFEFF/, "")),
    tags,
    partsOfSpeech,
    files: entryFiles,
  });
}
