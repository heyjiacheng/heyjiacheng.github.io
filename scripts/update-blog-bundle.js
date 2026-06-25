const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const bundlePath = path.join(
  root,
  "blog",
  "math-of-world-model-paradigms",
  "assets",
  "main-frAv0iFn.js"
);
const articleHtmlPath = path.join(
  root,
  "blog",
  "math-of-world-model-paradigms",
  "index.html"
);

const articles = [
  {
    constantName: "a5",
    markdownPath: path.join(root, "blog", "content", "world-models.md")
  },
  {
    constantName: "l5",
    markdownPath: path.join(root, "blog", "content", "world-models-en.md")
  }
];

function findStringLiteralEnd(source, valueStart) {
  const quote = source[valueStart];
  if (!["`", "\"", "'"].includes(quote)) {
    throw new Error(`Expected a string literal at offset ${valueStart}`);
  }

  for (let index = valueStart + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (quote === "`" && character === "$" && source[index + 1] === "{") {
      throw new Error("Unexpected template interpolation in embedded Markdown");
    }
    if (character === quote) {
      return index + 1;
    }
  }

  throw new Error(`Could not find end of string literal starting at ${valueStart}`);
}

function replaceEmbeddedString(source, constantName, markdown) {
  const before = `${constantName}=`;
  const start = source.indexOf(before);
  if (start === -1) {
    throw new Error(`Could not find ${constantName} in ${bundlePath}`);
  }

  const valueStart = start + before.length;
  const end = findStringLiteralEnd(source, valueStart);

  return source.slice(0, valueStart) + JSON.stringify(markdown) + source.slice(end);
}

function applyLocaleMetadataPatches(source) {
  return source
    .replace(
      'children:e.language==="zh"?"，":", "',
      'children:e.language==="zh"?"， ":", "'
    )
    .replace(
      'children:", "',
      'children:e.language==="zh"?"， ":", "'
    )
    .replace(
      'children:["Published ",e.publishedDate]',
      'children:[e.language==="zh"?"发布于":"Published ",e.publishedDate]'
    );
}

let bundle = fs.readFileSync(bundlePath, "utf8");
for (const article of articles) {
  const markdown = fs.readFileSync(article.markdownPath, "utf8");
  article.markdown = markdown;
  bundle = replaceEmbeddedString(bundle, article.constantName, markdown);
}
bundle = applyLocaleMetadataPatches(bundle);
fs.writeFileSync(bundlePath, bundle, "utf8");

for (const article of articles) {
  const expected = `${article.constantName}=${JSON.stringify(article.markdown)}`;
  if (!bundle.includes(expected)) {
    throw new Error(`Verification failed for ${article.constantName}`);
  }
}

const stamp = new Date()
  .toISOString()
  .replace(/[-:TZ.]/g, "")
  .slice(0, 14);
let articleHtml = fs.readFileSync(articleHtmlPath, "utf8");
articleHtml = articleHtml.replace(
  /src="assets\/main-frAv0iFn\.js(?:\?v=[^"]*)?"/,
  `src="assets/main-frAv0iFn.js?v=${stamp}"`
);
fs.writeFileSync(articleHtmlPath, articleHtml, "utf8");

console.log(`Updated blog bundle from Markdown and bumped cache key to ${stamp}.`);
console.log("Verified embedded Markdown for zh and en article variants.");
