# Website of Jiacheng Xu

This is the website of Jiacheng Xu. Link is at [https://heyjiacheng.github.io/](https://heyjiacheng.github.io/).

The website was built from Dr. Boyuan Chen's [Homepage](https://www.boyuan.space/). Thanks!


check before publish:
```bash
python3 -m http.server 8000
```

## Writing a blog post

One-time setup: `npm install`

```bash
npm run new                   # creates blog/posts/<today>/index.md (a draft)
npm run dev                   # live rebuild + preview at http://localhost:8000/blog/
```

Write Markdown (LaTeX math with `$...$` / `$$...$$`, code blocks, tables), and put images
in the same folder. Delete `draft: true` from the front matter to publish, then:

```bash
npm run build
git add -A && git commit -m "new post" && git push
```

`npm run build` generates `blog/<slug>/index.html`, the blog index, `blog/feed.xml` (RSS),
`sitemap.xml` and `robots.txt`. Don't edit those by hand. Posts with a `page:` field in their
front matter (see `blog/posts/unitree-g1-teleoperation.md`) are hand-made pages that only get listed.
