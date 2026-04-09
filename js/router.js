/**
 * Hermione's Library — Router & Renderer
 * Zero-build markdown content system + Supabase comments
 */

const SUPABASE_URL = 'https://bdgjwidsylevgkgruonm.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkZ2p3aWRzeWxldmdrZ3J1b25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Njg4NjAsImV4cCI6MjA5MTI0NDg2MH0.7kmi9Q3AiB--OgxS3GggbFMi0RuPWlPU-XrYxs_mhuc';

let supabase;
if (typeof window !== 'undefined' && window.supabase) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
}

const Library = {
  manifestUrl: 'articles/manifest.json',
  manifest: null,
  currentUser: null,

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

    // Add Supabase comments
    this.initComments(slug);

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

  // ===== SUPABASE COMMENTS =====
  async initComments(slug) {
    // Check auth state
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const u = session.user;
        this.currentUser = {
          id: u.id,
          name: u.user_metadata?.full_name || u.email?.split('@')[0] || '마법사',
          avatar: u.user_metadata?.avatar_url || null,
          email: u.email
        };
      }
    }

    const section = document.createElement('div');
    section.className = 'comment-section';
    section.innerHTML = `
      <div class="comment-header">
        <h2>🙋‍♀️ 손들고 결과 공유하기</h2>
        <p>해보신 분, 댓글로 알려주세요!</p>
      </div>
      <div id="comment-auth"></div>
      <div id="comment-input"></div>
      <div id="comment-list"><div class="comment-loading">📖 댓글 불러오는 중...</div></div>
    `;

    const navEl = document.getElementById('article-nav');
    if (navEl) {
      navEl.parentNode.insertBefore(section, navEl);
    }

    this.renderAuth();
    this.renderCommentInput(slug);
    this.loadComments(slug);
  },

  renderAuth() {
    const el = document.getElementById('comment-auth');
    if (!el) return;

    if (this.currentUser) {
      el.innerHTML = `
        <div class="comment-user">
          ${this.currentUser.avatar ? `<img src="${this.currentUser.avatar}" alt="">` : ''}
          <span><strong>${this.currentUser.name}</strong>님으로 로그인됨</span>
          <button class="logout-btn" id="logout-btn">로그아웃</button>
        </div>
      `;
      document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        this.currentUser = null;
        this.renderAuth();
        this.renderCommentInput(new URLSearchParams(window.location.search).get('slug'));
      });
    } else {
      el.innerHTML = `
        <button class="comment-login-btn" id="google-login-btn">
          <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Google로 로그인
        </button>
      `;
      document.getElementById('google-login-btn')?.addEventListener('click', async () => {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.href }
        });
      });
    }
  },

  renderCommentInput(slug) {
    const el = document.getElementById('comment-input');
    if (!el) return;

    if (!this.currentUser) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = `
      <div class="comment-input-wrap">
        <textarea id="comment-textarea" placeholder="해보신 결과나 질문을 남겨주세요 📝"></textarea>
        <button class="comment-submit" id="comment-submit-btn">댓글 남기기</button>
      </div>
    `;

    document.getElementById('comment-submit-btn')?.addEventListener('click', async () => {
      const textarea = document.getElementById('comment-textarea');
      const content = textarea?.value?.trim();
      if (!content) return;

      const btn = document.getElementById('comment-submit-btn');
      btn.disabled = true;
      btn.textContent = '전송 중...';

      const { error } = await supabase.from('comments').insert({
        article_slug: slug,
        user_id: this.currentUser.id,
        user_name: this.currentUser.name,
        user_avatar: this.currentUser.avatar,
        content
      });

      if (error) {
        btn.textContent = '오류 발생 — 다시 시도해주세요';
        btn.disabled = false;
        return;
      }

      textarea.value = '';
      btn.textContent = '댓글 남기기';
      btn.disabled = false;
      this.loadComments(slug);
    });
  },

  async loadComments(slug) {
    const el = document.getElementById('comment-list');
    if (!el || !supabase) return;

    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('article_slug', slug)
      .order('created_at', { ascending: true });

    if (error) {
      el.innerHTML = '<div class="comment-empty">댓글을 불러올 수 없어요 😅</div>';
      return;
    }

    if (!data || data.length === 0) {
      el.innerHTML = '<div class="comment-empty">아직 댓글이 없어요. 첫 번째로 손들어주세요 🙋‍♀️</div>';
      return;
    }

    el.innerHTML = data.map(c => {
      const date = new Date(c.created_at).toLocaleDateString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      const isOwn = this.currentUser?.id === c.user_id;
      const escapedContent = c.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
        <div class="comment-item" data-id="${c.id}">
          <div class="comment-item-header">
            ${c.user_avatar ? `<img src="${c.user_avatar}" alt="">` : ''}
            <span class="name">${c.user_name}</span>
            <span class="date">${date}</span>
          </div>
          <div class="comment-item-body">${escapedContent}</div>
          ${isOwn ? `<button class="delete-btn" onclick="Library.deleteComment('${c.id}', '${slug}')">삭제</button>` : ''}
        </div>
      `;
    }).join('');
  },

  async deleteComment(id, slug) {
    if (!confirm('댓글을 삭제할까요?')) return;
    await supabase.from('comments').delete().eq('id', id);
    this.loadComments(slug);
  },

  // Auto-detect page and init
  init() {
    // Handle OAuth redirect (Supabase returns tokens in hash)
    if (supabase && window.location.hash.includes('access_token')) {
      supabase.auth.getSession().then(() => {
        // Remove hash and reload cleanly
        const cleanUrl = window.location.href.split('#')[0];
        window.history.replaceState(null, '', cleanUrl);
        window.location.reload();
      });
      return;
    }

    const path = window.location.pathname;
    if (path.includes('article.html') || path.includes('article')) {
      this.initArticle();
    } else {
      this.initIndex();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => Library.init());
