// Builds the blog from Markdown into static HTML (good for search engines).
//
//   npm run build   build once
//   npm run dev     build, rebuild on change, serve at http://localhost:8000
//
// Sources live in blog/posts/, one per post, as either
//   blog/posts/<slug>.md
//   blog/posts/<slug>/index.md   (other files in the folder, e.g. images, are copied)
// Output: blog/<slug>/index.html, blog/index.html, blog/feed.xml, sitemap.xml, robots.txt.
// Files/folders starting with "_" are ignored (use them for templates or scratch).

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";

const SITE_URL = "https://heyjiacheng.github.io";
const AUTHOR = "Jiacheng Xu";
const KATEX_VERSION = JSON.parse(fs.readFileSync(new URL("../node_modules/katex/package.json", import.meta.url))).version;
const HLJS_VERSION = JSON.parse(fs.readFileSync(new URL("../node_modules/highlight.js/package.json", import.meta.url))).version;
const GENERATED_MARKER = '<meta name="generator" content="scripts/build-blog.mjs" />';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const blogDir = path.join(root, "blog");
const postsDir = path.join(blogDir, "posts");

const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    }
  }),
  markedKatex({ throwOnError: false, nonStandard: true })
);

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const toIsoDate = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));

const formatDate = (iso, lang) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  });

function estimateReadingTime(markdown) {
  const text = markdown.replace(/\$\$[\s\S]*?\$\$/g, "").replace(/```[\s\S]*?```/g, "");
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const words = (text.replace(/[\u4e00-\u9fff]/g, " ").match(/\S+/g) || []).length;
  return Math.max(1, Math.round(words / 220 + cjk / 400));
}

// Allow HackMD/Typora-style display math with content on the $$ lines,
// e.g. "$$x=\n1$$", by moving the delimiters onto their own lines.
function normalizeDisplayMath(markdown) {
  let inFence = false;
  let inMath = false;
  return markdown
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (/^(```|~~~)/.test(t)) inFence = !inFence;
      if (inFence) return line;
      if (!inMath && t.startsWith("$$") && !(t.length > 4 && t.endsWith("$$"))) {
        inMath = true;
        const rest = t.slice(2).trim();
        return rest ? `$$\n${rest}` : "$$";
      }
      if (inMath && t.endsWith("$$")) {
        inMath = false;
        const rest = t.slice(0, -2).trim();
        return rest ? `${rest}\n$$` : "$$";
      }
      return line;
    })
    .join("\n");
}

function readPosts() {
  const posts = [];
  for (const entry of fs.readdirSync(postsDir, { withFileTypes: true })) {
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    let file, assetDir, slug;
    if (entry.isDirectory()) {
      file = path.join(postsDir, entry.name, "index.md");
      if (!fs.existsSync(file)) continue;
      assetDir = path.join(postsDir, entry.name);
      slug = entry.name;
    } else if (entry.name.endsWith(".md")) {
      file = path.join(postsDir, entry.name);
      slug = entry.name.replace(/\.md$/, "");
    } else continue;

    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    for (const key of ["title", "date", "summary"]) {
      if (!data[key]) throw new Error(`${path.relative(root, file)}: missing "${key}" in front matter`);
    }
    if (data.draft) continue;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      throw new Error(`${path.relative(root, file)}: file name must be lowercase letters, digits and dashes`);
    }

    posts.push({
      slug,
      file,
      assetDir,
      title: data.title,
      date: toIsoDate(data.date),
      updated: data.updated ? toIsoDate(data.updated) : null,
      summary: data.summary,
      tags: data.tags || [],
      lang: data.lang || "en",
      image: data.image || null,
      readingTime: data.readingTime || estimateReadingTime(content),
      href: data.page || `${slug}/`, // `page` = hand-made page, don't generate
      generated: !data.page,
      content: normalizeDisplayMath(content)
    });
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

function navbar(prefix, activeBlog) {
  return `  <nav id="navbar" class="navbar navbar-expand-md navbar-dark blog-nav">
    <div class="container">
      <a class="navbar-brand logo" href="${prefix}" aria-label="Jiacheng Xu homepage">Jiacheng Xu</a>
      <button class="navbar-toggler collapsed" type="button" data-toggle="collapse" data-target="#navbarCollapse"
        aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="navbar-collapse collapse" id="navbarCollapse">
        <ul class="navbar-nav ml-auto">
          <li class="nav-item"><a href="${prefix}#home" class="nav-link">Home</a></li>
          <li class="nav-item"><a href="${prefix}#about" class="nav-link">About</a></li>
          <li class="nav-item"><a href="${prefix}blog/" class="nav-link${activeBlog ? " active" : ""}">Blog</a></li>
          <li class="nav-item"><a href="${prefix}#research" class="nav-link">Research</a></li>
          <li class="nav-item"><a href="${prefix}#portfolio" class="nav-link">Misc</a></li>
        </ul>
      </div>
    </div>
  </nav>`;
}

function head({ prefix, title, description, url, lang, type, image, extra = "" }) {
  const img = image ? new URL(image, url).href : null;
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${GENERATED_MARKER}
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="author" content="${AUTHOR}" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" type="application/rss+xml" title="Jiacheng Xu — Blog" href="${SITE_URL}/blog/feed.xml" />
  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="Jiacheng Xu" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:locale" content="${lang === "zh" ? "zh_CN" : "en_US"}" />
  ${img ? `<meta property="og:image" content="${img}" />\n  ` : ""}<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}" />
  <link href="${prefix}data/洒1.ico" rel="icon" type="image/x-icon" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css?family=Raleway:200,300,400,500,600,700,800,900%7cOpen+Sans:400,600,700,800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${prefix}css/bootstrap.css" />
  <link rel="stylesheet" href="${prefix}css/style.css" />
  <link rel="stylesheet" href="${prefix}css/site-extra.css" />
${extra}</head>`;
}

const footer = (prefix) => `  <footer id="footer" class="pt-50 pb-50">
    <div class="container">
      <div class="row text-center">
        <div class="col-md-12">
          <p class="copy pt-12">${AUTHOR} &copy; ${new Date().getFullYear()}. All Right Reserved.</p>
        </div>
      </div>
    </div>
  </footer>

  <script src="${prefix}js/jquery.min.js"></script>
  <script src="${prefix}js/bootstrap.min.js"></script>`;

const tagsHtml = (tags) =>
  tags.length
    ? `<div class="writing-tags" aria-label="Article tags">${tags.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>`
    : "";

function renderPost(post) {
  const prefix = "../../";
  const url = `${SITE_URL}/blog/${post.slug}/`;
  // Drop a leading "# Title" that just repeats the front-matter title.
  const body = marked.parse(post.content.replace(/^\s*#\s+(.+)\n/, (m, h) => (h.trim() === post.title ? "" : m)));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    dateModified: post.updated || post.date,
    inLanguage: post.lang === "zh" ? "zh-CN" : "en",
    url,
    mainEntityOfPage: url,
    author: { "@type": "Person", name: AUTHOR, url: `${SITE_URL}/` },
    keywords: post.tags.join(", "),
    ...(post.image ? { image: new URL(post.image, url).href } : {})
  };
  const extra = `  <meta property="article:published_time" content="${post.date}" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@${HLJS_VERSION}/styles/github.min.css" />
  <link rel="stylesheet" href="${prefix}css/blog-post.css" />
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
`;
  return `<!DOCTYPE html>
<html lang="${post.lang === "zh" ? "zh-CN" : "en"}">
${head({ prefix, title: `${post.title} | ${AUTHOR}`, description: post.summary, url, lang: post.lang, type: "article", image: post.image, extra })}

<body class="writing-page">
${navbar(prefix, true)}

  <main class="post">
    <article class="container post-container">
      <a class="writing-index-back" href="../">&larr; All posts</a>
      <header class="post-header">
        <h1>${escapeHtml(post.title)}</h1>
        <div class="writing-card-meta">
          <time datetime="${post.date}">${formatDate(post.date, post.lang)}</time>
          <span>${post.readingTime} ${post.lang === "zh" ? "分钟阅读" : "min read"}</span>
        </div>
        ${tagsHtml(post.tags)}
      </header>
      <div class="post-body">
${body}
      </div>
    </article>
  </main>

${footer(prefix)}
</body>
</html>
`;
}

function renderIndex(posts) {
  const prefix = "../";
  const cards = posts
    .map(
      (p) => `        <article class="writing-card">
          <div>
            <div class="writing-card-meta">
              <time datetime="${p.date}">${formatDate(p.date, "en")}</time>
              <span>${p.readingTime} min read</span>
            </div>
            <h2><a href="${p.href}">${escapeHtml(p.title)}</a></h2>
            <p>${escapeHtml(p.summary)}</p>
            ${tagsHtml(p.tags)}
          </div>
          <a class="writing-card-link" href="${p.href}">Read article &rarr;</a>
        </article>`
    )
    .join("\n");
  const description = "Technical notes and mathematical reflections on AI and robotics by Jiacheng Xu.";
  return `<!DOCTYPE html>
<html lang="en">
${head({ prefix, title: `Blog | ${AUTHOR}`, description, url: `${SITE_URL}/blog/`, lang: "en", type: "website" })}

<body class="writing-page">
${navbar(prefix, true).replace(`href="${prefix}blog/"`, 'href="./"')}

  <main class="writing-index">
    <div class="container">
      <header class="writing-index-header">
        <div class="writing-index-kicker">Technical Notes</div>
        <h1>Blog</h1>
        <p>Technical notes, and mathematical reflections on AI and Robotics.</p>
      </header>

      <section class="writing-list" aria-label="Blog posts">
${cards}
      </section>
    </div>
  </main>

${footer(prefix)}
</body>
</html>
`;
}

function renderFeed(posts) {
  const items = posts
    .map((p) => {
      const link = new URL(p.href, `${SITE_URL}/blog/`).href;
      return `    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeHtml(p.summary)}</description>
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Jiacheng Xu — Blog</title>
    <link>${SITE_URL}/blog/</link>
    <atom:link href="${SITE_URL}/blog/feed.xml" rel="self" type="application/rss+xml" />
    <description>Technical notes and mathematical reflections on AI and robotics.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
}

function renderSitemap(posts) {
  const urls = [
    { loc: `${SITE_URL}/` },
    { loc: `${SITE_URL}/blog/`, lastmod: posts[0]?.date },
    ...posts.map((p) => ({ loc: new URL(p.href, `${SITE_URL}/blog/`).href, lastmod: p.updated || p.date }))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n")}
</urlset>
`;
}

function writeIfChanged(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function build() {
  const posts = readPosts();
  for (const post of posts.filter((p) => p.generated)) {
    const outDir = path.join(blogDir, post.slug);
    const outFile = path.join(outDir, "index.html");
    // Never clobber a hand-made page that happens to share the slug.
    if (fs.existsSync(outFile) && !fs.readFileSync(outFile, "utf8").includes(GENERATED_MARKER)) {
      throw new Error(`${path.relative(root, outFile)} exists and was not generated by this script; pick another slug`);
    }
    writeIfChanged(outFile, renderPost(post));
    if (post.assetDir) {
      for (const f of fs.readdirSync(post.assetDir, { recursive: true })) {
        const src = path.join(post.assetDir, f);
        if (f === "index.md" || fs.statSync(src).isDirectory()) continue;
        fs.mkdirSync(path.dirname(path.join(outDir, f)), { recursive: true });
        fs.copyFileSync(src, path.join(outDir, f));
      }
    }
  }
  // Remove pages generated earlier for posts that were since deleted or made drafts.
  const live = new Set(posts.filter((p) => p.generated).map((p) => p.slug));
  for (const entry of fs.readdirSync(blogDir, { withFileTypes: true })) {
    const page = path.join(blogDir, entry.name, "index.html");
    if (!entry.isDirectory() || live.has(entry.name) || !fs.existsSync(page)) continue;
    if (fs.readFileSync(page, "utf8").includes(GENERATED_MARKER)) {
      fs.rmSync(path.join(blogDir, entry.name), { recursive: true });
      console.log(`Removed blog/${entry.name}/ (no longer a published post)`);
    }
  }
  writeIfChanged(path.join(blogDir, "index.html"), renderIndex(posts));
  writeIfChanged(path.join(blogDir, "feed.xml"), renderFeed(posts));
  writeIfChanged(path.join(root, "sitemap.xml"), renderSitemap(posts));
  writeIfChanged(path.join(root, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  console.log(`Built ${posts.length} posts (${posts.filter((p) => p.generated).length} from Markdown).`);
}

function serve(port) {
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
    ".xml": "application/xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
    ".svg": "image/svg+xml", ".webp": "image/webp", ".mp4": "video/mp4", ".ico": "image/x-icon", ".woff2": "font/woff2" };
  http
    .createServer((req, res) => {
      let file = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (!file.startsWith(root)) return res.writeHead(403).end();
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      if (!fs.existsSync(file)) return res.writeHead(404).end("Not found");
      res.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    })
    .listen(port, () => console.log(`Serving at http://localhost:${port}/blog/  (Ctrl+C to stop)`));
}

build();

if (process.argv.includes("--watch")) {
  let timer;
  fs.watch(postsDir, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        build();
      } catch (err) {
        console.error(err.message);
      }
    }, 150);
  });
  serve(8000);
}
