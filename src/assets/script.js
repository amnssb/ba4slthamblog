// 🌸 Anime Sakura - Main Script
(function() {
  'use strict';

  // ========================================
  // Theme Toggle
  // ========================================
  function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    // Check saved preference or system preference
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (saved === 'dark' || (!saved && prefersDark)) {
      document.body.classList.add('dark-mode');
    }

    toggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
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

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    function resize(shouldReset = false) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
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
        this.x = Math.random() * canvas.width;
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

        if (this.y > canvas.height + 20 || this.x < -20 || this.x > canvas.width + 20) {
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
      const particleCount = Math.min(window.innerWidth < 768 ? 8 : 16, Math.max(6, Math.floor(window.innerWidth / 96)));
      for (let i = 0; i < particleCount; i++) {
        const p = new Particle();
        p.y = Math.random() * canvas.height;
        particles.push(p);
      }
    }

    init();

    let lastFrameTime = performance.now();
    function animate(now) {
      if (!isVisible) return;

      const delta = Math.min(now - lastFrameTime, 40);
      lastFrameTime = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
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

    // Lightbox for post images
    const postImages = document.querySelectorAll('.post-content img');
    postImages.forEach(img => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => {
        // Simple lightbox
        const lightbox = document.createElement('div');
        lightbox.style.cssText = `
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          cursor: zoom-out;
          opacity: 0;
          transition: opacity 0.3s;
        `;
        
        const lightboxImg = document.createElement('img');
        lightboxImg.src = img.src;
        lightboxImg.style.cssText = `
          max-width: 90%;
          max-height: 90%;
          border-radius: 8px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        `;
        
        lightbox.appendChild(lightboxImg);
        document.body.appendChild(lightbox);
        document.body.style.overflow = 'hidden';
        
        requestAnimationFrame(() => lightbox.style.opacity = '1');

        const closeLightbox = () => {
          lightbox.style.opacity = '0';
          document.body.style.overflow = '';
          document.removeEventListener('keydown', onKeyDown);
          setTimeout(() => lightbox.remove(), 300);
        };

        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            closeLightbox();
          }
        };

        document.addEventListener('keydown', onKeyDown);
        lightbox.addEventListener('click', closeLightbox);
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
    progressBar.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--primary), var(--secondary));
      z-index: 10001;
      transition: width 0.1s;
    `;
    document.body.appendChild(progressBar);

    window.addEventListener('scroll', () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      progressBar.style.width = scrolled + '%';
    }, { passive: true });
  }

  // ========================================
  // Mobile Navigation
  // ========================================
  function initMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const mobileNav = document.querySelector('.nav-mobile');
    if (!toggle || !mobileNav) return;

    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      mobileNav.classList.toggle('show');
      toggle.setAttribute('aria-expanded', String(mobileNav.classList.contains('show')));
    });

    mobileNav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        toggle.classList.remove('active');
        mobileNav.classList.remove('show');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !mobileNav.contains(e.target)) {
        toggle.classList.remove('active');
        mobileNav.classList.remove('show');
        toggle.setAttribute('aria-expanded', 'false');
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
    const loadIndex = () => {
      if (!indexPromise) {
        indexPromise = fetch(document.body.dataset.searchIndex)
          .then((response) => response.ok ? response.json() : [])
          .catch(() => []);
      }
      return indexPromise;
    };

    function renderResults(items) {
      results.replaceChildren();
      if (!items.length) {
        results.textContent = input.value.trim() ? '没有找到匹配内容。' : '输入关键词开始搜索。';
        return;
      }

      items.slice(0, 10).forEach((item) => {
        const link = document.createElement('a');
        link.href = item.url;
        link.className = 'search-result';

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
      const query = input.value.trim().toLowerCase();
      const index = await loadIndex();
      if (!query) return renderResults([]);
      const matches = index.filter((item) => [item.title, item.category, item.excerpt, ...(item.tags || [])]
        .join(' ')
        .toLowerCase()
        .includes(query));
      renderResults(matches);
    });
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
    initImages();
    initProgressBar();
    initMobileNav();
    initSearch();
    initPwa();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
