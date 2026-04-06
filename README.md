# Thanh's Journal

An Economist-style personal blog built with Jekyll for GitHub Pages.

## Structure

```
├── _config.yml         # Site settings
├── _layouts/           # Page templates
├── _includes/          # Reusable components
├── _posts/             # Your articles (Markdown)
├── assets/css/         # SCSS styles
├── tag/                # Tag index pages
└── index.html          # Homepage
```

## Writing a New Post

Create a file in `_posts/` named `YYYY-MM-DD-your-title.md`:

```markdown
---
layout: post
title: "Your Article Title"
date: 2026-04-06
tag: economics          # politics | economics | analysis | technical | asia | world | life
description: "One-sentence summary shown in card previews."
read_time: 5
featured: true          # Set true for ONE post to appear as the homepage hero
image: /assets/images/your-image.jpg
---

Your article content here in **Markdown**.
```

## Available Tags

| Tag | URL |
|-----|-----|
| `politics` | `/tag/politics/` |
| `economics` | `/tag/economics/` |
| `analysis` | `/tag/analysis/` |
| `technical` | `/tag/technical/` |
| `asia` | `/tag/asia/` |
| `world` | `/tag/world/` |
| `life` | `/tag/life/` |

## Deployment

Push to the `main` branch. GitHub Pages builds the site automatically within ~60 seconds.

Site will be live at: **https://thanhback0904.github.io**
