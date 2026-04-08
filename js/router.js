/**
 * Hermione's Library — Router & Renderer
 * Zero-build markdown content system
 */

const Library = {
  manifestUrl: 'articles/manifest.json',
  manifest: null,

  // Parse YAML-like frontmatter from markdown
  parseFrontmatter(raw) {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { meta: {}, body: raw };
    const meta = {};
    match[1].split('\n').forEach(line => {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        meta[key] = val;
      }
    });
    return { meta, body: match[2] };
  },

  // Load manifest
  async loadManifest() {
    if (this.manifest) return this.manifest;
    const res = await fetch(this.manifestUrl);
    this.manifest = await res.json();
    return this.manifest;
  },

  // Find article in manifest by slug
  findArticle(slug) {
    for (const section of this.manifest.sections) {
      const article = section.articles.find(a => a.slug === slug);
      if (article) return { article, section };
    }
    return null;
  },

  // Get all published articles in a section
  getPublished(sectionId) {
    const section = this.manifest.sections.find(s => s.id === sectionId);
    if (!section) return [];
    return section.articles.filter(a => a.status === 'published');
  },

  // Get prev/next article within same section
  getPrevNext(slug) {
    for (const section of this.manifest.sections) {
      const published = section.articles.filter(a => a.status === 'published');
      const idx = published.findIndex(a => a.slug === slug);
      if (idx === -1) continue;
      return {
        prev: idx > 0 ? published[idx - 1] : null,
        next: idx < published.length - 1 ? published[idx + 1] : null
      };
    }
    return { prev: null, next: null };
  },

  // ===== INDEX PAGE =====
  async initIndex() {
    const manifest = await this.loadManifest();

    manifest.sections.forEach(section => {
      const gridEl = document.getElementById(`${section.id}-grid`);
      const countEl = document.getElementById(`${section.id}-count`);
      if (!gridEl) return;

      const articles = section.articles;
      const published = articles.filter(a => a.status === 'published');

      if (countEl) {
        countEl.textContent = `${section.subtitle} · ${articles.length} episodes`;
      }

      gridEl.innerHTML = articles.map(a => {
        const isPublished = a.status === 'published';
        const href = isPublished ? `article.html?slug=${a.slug}` : '#';
        const draftClass = isPublished ? '' : ' article-draft';
        const excerptHtml = (a.excerpt || '').replace(/\n/g, '<br>');

        const metaHtml = a.tag
          ? `<span class="article-tag">${a.tag}</span><span>${a.audience || a.date || ''}</span>`
          : `<span>${a.date || ''}</span><span>·</span><span>${a.tag || ''}</span>`;

        return `
          <a class="article-item${draftClass}" href="${href}" ${!isPublished ? 'onclick="return false"' : ''}>
            <div class="article-num">${a.num}</div>
            <h3>${a.title}</h3>
            <p>${excerptHtml}</p>
            <div class="article-meta">
              ${metaHtml}
              ${!isPublished ? '<span class="draft-badge">준비중</span>' : ''}
            </div>
          </a>
        `;
      }).join('');
    });
  },

  // ===== ARTICLE PAGE =====
  async initArticle() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');

    if (!slug) {
      window.location.href = 'index.html';
      return;
    }

    const manifest = await this.loadManifest();
    const found = this.findArticle(slug);

    if (!found || found.article.status !== 'published') {
      document.getElementById('article-content').innerHTML = `
        <div style="text-align:center; padding: 80px 0;">
          <p style="font-size: 48px; margin-bottom: 16px;">📚</p>
          <h2 style="margin-bottom: 12px;">아직 준비 중인 페이지예요</h2>
          <p style="color: var(--ink-secondary);">이 주문은 아직 교과서에 정리되지 않았어요.</p>
          <a href="index.html" style="display:inline-block; margin-top:24px; color:var(--maroon); font-weight:600;">← 도서관으로 돌아가기</a>
        </div>
      `;
      return;
    }

    const { article, section } = found;

    // Fetch markdown
    const res = await fetch(`articles/${slug}.md`);
    const raw = await res.text();
    const { meta, body } = this.parseFrontmatter(raw);

    // Set page title
    document.title = `${meta.title || article.title} — Hermione's Library`;

    // Render breadcrumb
    const breadcrumb = document.getElementById('article-breadcrumb');
    if (breadcrumb) {
      breadcrumb.innerHTML = `
        <a href="index.html">📚 도서관 로비</a>
        <span>›</span>
        <a href="index.html#${section.id}">${section.emoji} ${section.title}</a>
        <span>›</span>
        <span class="current">${article.title}</span>
      `;
    }

    // Render article meta
    const metaEl = document.getElementById('article-meta');
    if (metaEl) {
      metaEl.innerHTML = `
        <span class="article-tag">${article.tag || meta.tag || ''}</span>
        <span>📚 Hermione</span>
        <span>·</span>
        <span>${article.date || meta.date || ''}</span>
      `;
    }

    // Render markdown body
    const contentEl = document.getElementById('article-content');
    if (contentEl && typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,
        gfm: true
      });
      contentEl.innerHTML = marked.parse(body);
    }

    // Convert ☐/☑ to interactive checkboxes (localStorage)
    this.initCheckboxes(slug, contentEl);

    // Add giscus comments
    this.initComments();

    // Render prev/next
    const { prev, next } = this.getPrevNext(slug);
    const navEl = document.getElementById('article-nav');
    if (navEl) {
      navEl.innerHTML = `
        <div class="nav-prev">
          ${prev ? `<a href="article.html?slug=${prev.slug}">← ${prev.title}</a>` : ''}
        </div>
        <div class="nav-home">
          <a href="index.html">📚 도서관으로</a>
        </div>
        <div class="nav-next">
          ${next ? `<a href="article.html?slug=${next.slug}">${next.title} →</a>` : ''}
        </div>
      `;
    }
  },

  // ===== CHECKBOXES =====
  initCheckboxes(slug, container) {
    const storageKey = `hermione-hw-${slug}`;
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');

    // Find all ☐ and ☑ in table cells and replace with real checkboxes
    container.querySelectorAll('td').forEach(td => {
      const text = td.textContent.trim();
      if (text === '☐' || text === '☑') {
        const idx = td.closest('tr').rowIndex;
        const checked = saved[idx] || false;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = checked;
        cb.style.cssText = 'width:18px; height:18px; cursor:pointer; accent-color:#7c2d12;';
        cb.addEventListener('change', () => {
          saved[idx] = cb.checked;
          localStorage.setItem(storageKey, JSON.stringify(saved));
          // Strike-through the row text when checked
          const row = cb.closest('tr');
          if (row) {
            row.querySelectorAll('td:not(:last-child)').forEach(cell => {
              cell.style.textDecoration = cb.checked ? 'line-through' : 'none';
              cell.style.opacity = cb.checked ? '0.5' : '1';
            });
          }
        });

        td.textContent = '';
        td.style.textAlign = 'center';
        td.appendChild(cb);

        // Apply saved state styling
        if (checked) {
          const row = td.closest('tr');
          if (row) {
            row.querySelectorAll('td:not(:last-child)').forEach(cell => {
              cell.style.textDecoration = 'line-through';
              cell.style.opacity = '0.5';
            });
          }
        }
      }
    });
  },

  // ===== GISCUS COMMENTS =====
  initComments() {
    const commentSection = document.createElement('div');
    commentSection.style.cssText = 'max-width:780px; margin:0 auto; padding:0 2rem 64px;';
    commentSection.innerHTML = `
      <div style="border-top:2px solid var(--ink); padding-top:32px; margin-bottom:24px;">
        <h2 style="font-size:22px; font-weight:700; margin-bottom:8px;">🙋‍♀️ 손들고 결과 공유하기</h2>
        <p style="font-size:15px; color:var(--ink-secondary);">해보신 분, 댓글로 알려주세요. GitHub 계정으로 로그인하면 댓글을 남길 수 있어요.</p>
      </div>
    `;

    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.setAttribute('data-repo', 'hslee-byte/hermione-library');
    script.setAttribute('data-repo-id', 'R_kgDOR9CaJg');
    script.setAttribute('data-category', 'General');
    script.setAttribute('data-category-id', 'DIC_kwDOR9CaJs4C6YO2');
    script.setAttribute('data-mapping', 'pathname');
    script.setAttribute('data-strict', '0');
    script.setAttribute('data-reactions-enabled', '1');
    script.setAttribute('data-emit-metadata', '0');
    script.setAttribute('data-input-position', 'top');
    script.setAttribute('data-theme', 'light');
    script.setAttribute('data-lang', 'ko');
    script.setAttribute('crossorigin', 'anonymous');
    script.async = true;

    commentSection.appendChild(script);

    // Insert before the article-nav
    const navEl = document.getElementById('article-nav');
    if (navEl) {
      navEl.parentNode.insertBefore(commentSection, navEl);
    }
  },

  // Auto-detect page and init
  init() {
    const path = window.location.pathname;
    if (path.includes('article.html') || path.includes('article')) {
      this.initArticle();
    } else {
      this.initIndex();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => Library.init());
