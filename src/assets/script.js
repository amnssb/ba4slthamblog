// 🌸 Anime Sakura - Main Script
(function() {
  'use strict';

  // ========================================
  // Theme Toggle
  // ========================================
  function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const themeColor = document.querySelector('meta[name="theme-color"]');

    function applyTheme(isDark, persist = false) {
      root.classList.toggle('dark-mode', isDark);
      toggle.setAttribute('aria-pressed', String(isDark));
      toggle.setAttribute('aria-label', isDark ? '切换到浅色主题' : '切换到深色主题');
      if (themeColor) themeColor.content = isDark ? '#151719' : '#f76aa8';
      if (persist) localStorage.setItem('theme', isDark ? 'dark' : 'light');

      const giscusFrame = document.querySelector('iframe.giscus-frame');
      giscusFrame?.contentWindow?.postMessage({
        giscus: { setConfig: { theme: isDark ? 'dark' : 'light' } },
      }, 'https://giscus.app');
    }

    applyTheme(root.classList.contains('dark-mode'));

    toggle.addEventListener('click', () => {
      applyTheme(!root.classList.contains('dark-mode'), true);
    });

    media.addEventListener('change', (event) => {
      if (!localStorage.getItem('theme')) applyTheme(event.matches);
    });
  }

  // ========================================
  // Back to Top
  // ========================================
  function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    const toggleVisibility = () => {
      if (window.scrollY > 400) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ========================================
  // Particle Animation - Sakura Petals
  // ========================================
  function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    if (document.body.dataset.background !== 'particle') {
      canvas.remove();
      return;
    }

    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;
    let isVisible = true;
    let resizeId;
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      canvas.remove();
      return;
    }

    function resize(shouldReset = false) {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(viewportWidth * pixelRatio);
      canvas.height = Math.round(viewportHeight * pixelRatio);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      if (shouldReset) init();
    }

    resize();
    window.addEventListener('resize', () => {
      cancelAnimationFrame(resizeId);
      resizeId = requestAnimationFrame(() => resize(true));
    }, { passive: true });

    const themeColors = ['--primary', '--secondary', '--accent']
      .map((name) => getComputedStyle(document.body).getPropertyValue(name).trim())
      .filter(Boolean);

    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * viewportWidth;
        this.y = -20;
        this.size = Math.random() * 2.4 + 1.4;
        this.fallSpeed = Math.random() * 0.016 + 0.012;
        this.driftPhase = Math.random() * Math.PI * 2;
        this.driftSpeed = Math.random() * 0.00016 + 0.00008;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 0.018 - 0.009;
        this.opacity = Math.random() * 0.14 + 0.1;
        this.color = themeColors[Math.floor(Math.random() * themeColors.length)] || '#f472b6';
      }

      update(delta) {
        this.driftPhase += this.driftSpeed * delta;
        this.x += Math.sin(this.driftPhase) * 0.014 * delta;
        this.y += this.fallSpeed * delta;
        this.rotation += this.rotationSpeed * delta;

        if (this.y > viewportHeight + 20 || this.x < -20 || this.x > viewportWidth + 20) {
          this.reset();
        }
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = this.size * 2;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }

    // Initialize particles
    function init() {
      particles = [];
      const particleCount = Math.min(viewportWidth < 768 ? 8 : 16, Math.max(6, Math.floor(viewportWidth / 96)));
      for (let i = 0; i < particleCount; i++) {
        const p = new Particle();
        p.y = Math.random() * viewportHeight;
        particles.push(p);
      }
    }

    init();

    let lastFrameTime = performance.now();
    function animate(now) {
      if (!isVisible) return;

      const delta = Math.min(now - lastFrameTime, 40);
      lastFrameTime = now;
      ctx.clearRect(0, 0, viewportWidth, viewportHeight);
      particles.forEach((particle) => {
        particle.update(delta);
        particle.draw();
      });

      animationId = requestAnimationFrame(animate);
    }

    animate();

    // Visibility handling
    document.addEventListener('visibilitychange', () => {
      isVisible = document.visibilityState === 'visible';
      if (isVisible && !animationId) {
        lastFrameTime = performance.now();
        animationId = requestAnimationFrame(animate);
      } else if (!isVisible) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      cancelAnimationFrame(animationId);
      cancelAnimationFrame(resizeId);
    });
  }

  // ========================================
  // TOC Highlight
  // ========================================
  function initToc() {
    const toc = document.querySelector('.toc-glass');
    if (!toc) return;

    const headings = document.querySelectorAll('.post-content h2, .post-content h3');
    if (headings.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          toc.querySelectorAll('.toc-item').forEach(item => {
            item.classList.remove('active');
            const link = item.querySelector('a');
            if (link && link.getAttribute('href') === `#${id}`) {
              item.classList.add('active');
            }
          });
        }
      });
    }, { rootMargin: '-20% 0px -80% 0px' });

    headings.forEach(h => observer.observe(h));
  }

  // ========================================
  // Smooth Scroll for Anchor Links
  // ========================================
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // ========================================
  // Image Lazy Loading & Lightbox
  // ========================================
  function initImages() {
    // Lazy loading
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));

    // Accessible lightbox for post images
    const postImages = document.querySelectorAll('.post-content img');
    postImages.forEach(img => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => {
        const lightbox = document.createElement('dialog');
        lightbox.className = 'image-lightbox';
        lightbox.setAttribute('aria-label', img.alt ? `查看图片：${img.alt}` : '查看大图');
        const lightboxImg = document.createElement('img');
        lightboxImg.src = img.currentSrc || img.src;
        lightboxImg.alt = img.alt || '';
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'image-lightbox-close';
        closeButton.setAttribute('aria-label', '关闭大图');
        closeButton.textContent = '×';
        lightbox.append(lightboxImg, closeButton);
        document.body.appendChild(lightbox);
        lightbox.showModal();
        closeButton.focus();
        closeButton.addEventListener('click', () => lightbox.close());
        lightbox.addEventListener('click', (event) => {
          if (event.target === lightbox) lightbox.close();
        });
        lightbox.addEventListener('close', () => lightbox.remove(), { once: true });
      });
    });
  }

  // ========================================
  // Reading Progress Bar
  // ========================================
  function initProgressBar() {
    const post = document.querySelector('.post-content');
    if (!post) return;

    const progressBar = document.createElement('div');
    progressBar.id = 'reading-progress';
    document.body.appendChild(progressBar);

    let progressFrame;
    const updateProgress = () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      progressBar.style.transform = `scaleX(${scrolled / 100})`;
      progressFrame = null;
    };
    window.addEventListener('scroll', () => {
      if (!progressFrame) progressFrame = requestAnimationFrame(updateProgress);
    }, { passive: true });
    updateProgress();
  }

  // ========================================
  // Mobile Navigation
  // ========================================
  function initMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const mobileNav = document.querySelector('.nav-mobile');
    if (!toggle || !mobileNav) return;

    const setOpen = (isOpen) => {
      toggle.classList.toggle('active', isOpen);
      mobileNav.classList.toggle('show', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
    };

    toggle.addEventListener('click', () => setOpen(!mobileNav.classList.contains('show')));

    mobileNav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        setOpen(false);
      });
    });

    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !mobileNav.contains(e.target)) {
        setOpen(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && mobileNav.classList.contains('show')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  function initCoverPreviews() {
    document.querySelectorAll('img[data-cover-preview]').forEach((img) => {
      const media = img.closest('.post-card-media');
      const card = img.closest('.post-card');
      if (!media || !card) return;

      const markAsBroken = () => {
        img.hidden = true;
        media.dataset.coverOrientation = 'empty';
        card.dataset.coverOrientation = 'empty';
      };
      img.addEventListener('error', markAsBroken, { once: true });
      if (media.dataset.coverOrientation !== 'auto') return;

      const classify = () => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        const ratio = img.naturalWidth / img.naturalHeight;
        const orientation = ratio >= 1.15 ? 'landscape' : ratio <= 0.85 ? 'portrait' : 'square';
        media.dataset.coverOrientation = orientation;
        card.dataset.coverOrientation = orientation;
      };

      img.addEventListener('load', classify);
      if (img.complete) {
        if (img.naturalWidth) classify();
        else markAsBroken();
      }
    });
  }

  function initSearch() {
    const dialog = document.getElementById('site-search');
    const toggle = document.getElementById('search-toggle');
    const input = document.getElementById('site-search-input');
    const results = document.getElementById('site-search-results');
    if (!dialog || !toggle || !input || !results) return;

    let indexPromise;
    let activeResult = -1;
    const loadIndex = () => {
      if (!indexPromise) {
        indexPromise = fetch(document.body.dataset.searchIndex)
          .then((response) => response.ok ? response.json() : [])
          .catch(() => []);
      }
      return indexPromise;
    };

    const normalize = (value) => String(value || '').trim().toLocaleLowerCase('zh-CN');

    function searchIndex(index, query) {
      const terms = normalize(query).split(/\s+/).filter(Boolean);
      if (!terms.length) return [];

      return index
        .map((item) => {
          const title = normalize(item.title);
          const category = normalize(item.category);
          const tags = normalize((item.tags || []).join(' '));
          const excerpt = normalize(item.excerpt);
          const combined = `${title} ${category} ${tags} ${excerpt}`;
          if (!terms.every((term) => combined.includes(term))) return null;

          const score = terms.reduce((total, term) => total
            + (title === term ? 120 : 0)
            + (title.startsWith(term) ? 60 : 0)
            + (title.includes(term) ? 35 : 0)
            + (tags.includes(term) ? 20 : 0)
            + (category.includes(term) ? 12 : 0)
            + (excerpt.includes(term) ? 4 : 0), 0);
          return { item, score };
        })
        .filter(Boolean)
        .sort((left, right) => right.score - left.score || new Date(right.item.date) - new Date(left.item.date))
        .map(({ item }) => item);
    }

    function setActiveResult(nextIndex) {
      const links = [...results.querySelectorAll('.search-result')];
      if (!links.length) return;
      activeResult = (nextIndex + links.length) % links.length;
      links.forEach((link, index) => {
        const isActive = index === activeResult;
        link.classList.toggle('is-active', isActive);
        link.setAttribute('aria-selected', String(isActive));
      });
      results.setAttribute('aria-activedescendant', links[activeResult].id);
      links[activeResult].scrollIntoView({ block: 'nearest' });
    }

    function renderResults(items) {
      results.replaceChildren();
      activeResult = -1;
      results.removeAttribute('aria-activedescendant');
      if (!items.length) {
        results.textContent = input.value.trim() ? '没有找到匹配内容。' : '输入关键词开始搜索。';
        return;
      }

      items.slice(0, 10).forEach((item) => {
        const link = document.createElement('a');
        link.href = item.url;
        link.className = 'search-result';
        link.id = `search-result-${results.childElementCount}`;
        link.setAttribute('role', 'option');
        link.setAttribute('aria-selected', 'false');

        const title = document.createElement('strong');
        title.textContent = item.title || '未命名内容';
        const meta = document.createElement('span');
        meta.textContent = [item.date, item.category, ...(item.tags || [])].filter(Boolean).join(' · ');
        const excerpt = document.createElement('small');
        excerpt.textContent = item.excerpt || '';
        link.append(title, meta, excerpt);
        results.appendChild(link);
      });
    }

    toggle.addEventListener('click', async () => {
      dialog.showModal();
      input.focus();
      renderResults([]);
      await loadIndex();
    });

    input.addEventListener('input', async () => {
      const query = input.value.trim();
      const index = await loadIndex();
      if (!query) return renderResults([]);
      renderResults(searchIndex(index, query));
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveResult(activeResult + (event.key === 'ArrowDown' ? 1 : -1));
      } else if (event.key === 'Enter' && activeResult >= 0) {
        event.preventDefault();
        results.querySelectorAll('.search-result')[activeResult]?.click();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        dialog.close();
      }
    });

    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      input.value = '';
      renderResults([]);
      toggle.focus();
    });

    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      if (event.key === '/' && !isTyping && !dialog.open) {
        event.preventDefault();
        toggle.click();
      }
    });
  }

  function initUtcClock() {
    const clock = document.querySelector('[data-utc-clock]');
    if (!clock) return;

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const update = () => {
      const now = new Date();
      clock.dateTime = now.toISOString();
      clock.textContent = formatter.format(now);
    };
    update();
    const timer = window.setInterval(update, 1000);
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
  }

  function initPwa() {
    if (!('serviceWorker' in navigator)) return;
    if (['127.0.0.1', 'localhost'].includes(location.hostname)) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      return;
    }
    if (document.body.dataset.pwa !== 'true') return;
    navigator.serviceWorker.register(document.body.dataset.serviceWorker).catch(() => {});
  }

  // ========================================
  // Initialize All
  // ========================================
  function init() {
    initTheme();
    initBackToTop();
    initParticles();
    initToc();
    initSmoothScroll();
    initCoverPreviews();
    initImages();
    initProgressBar();
    initMobileNav();
    initSearch();
    initUtcClock();
    initPwa();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
