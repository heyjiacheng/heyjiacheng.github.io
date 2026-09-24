// Creates a new post draft named after today's date:  npm run new
// (or pick a name yourself:  npm run new -- my-post-slug)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const slug = process.argv[2] || today;
if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error("Usage: npm run new [-- my-post-slug]   (lowercase letters, digits and dashes)");
  process.exit(1);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "blog", "posts", slug);
if (fs.existsSync(dir) || fs.existsSync(`${dir}.md`) || fs.existsSync(path.join(dir, "..", "..", slug))) {
  console.error(`A post or page named "${slug}" already exists.`);
  process.exit(1);
}

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, "index.md"),
  `---
title: My New Post
date: ${today}
summary: One or two sentences shown on the blog index and in search results.
tags: [Robotics]
lang: en        # en or zh
draft: true     # delete this line to publish
# image: cover.png   # optional; used for link previews
---

Write here. Put images in this folder and reference them like ![alt](figure.png).

Inline math $p(a_t \\mid o_{1:t})$ and display math:

$$
\\pi(a_t \\mid o_{1:t}, a_{1:t-1}, l)
$$
`
);
console.log(`Created blog/posts/${slug}/index.md`);
