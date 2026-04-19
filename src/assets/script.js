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

    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;
    let isVisible = true;

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener('resize', resize);

    // Particle class
    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = -10;
        this.size = Math.random() * 5 + 3;
        this.speedX = Math.random() * 1 - 0.5;
        this.speedY = Math.random() * 1 + 0.5;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 2 - 1;
        this.opacity = Math.random() * 0.5 + 0.3;
        
        // Sakura pink colors
        const colors = ['#fbbf24', '#f472b6', '#fbcfe8', '#fde68a'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        
        // Petal shape
        this.type = Math.random() > 0.5 ? 'petal' : 'circle';
      }

      update() {
        this.x += this.speedX + Math.sin(this.y * 0.01) * 0.5;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;

        if (this.y > canvas.height + 10) {
          this.reset();
        }
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;

        if (this.type === 'petal') {
          // Draw petal shape
          ctx.beginPath();
          ctx.moveTo(0, -this.size);
          ctx.bezierCurveTo(this.size, -this.size, this.size, this.size, 0, this.size);
          ctx.bezierCurveTo(-this.size, this.size, -this.size, -this.size, 0, -this.size);
          ctx.fill();
        } else {
          // Draw circle
          ctx.beginPath();
          ctx.arc(0, 0, this.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }

    // Initialize particles
    function init() {
      particles = [];
      const particleCount = Math.min(30, Math.floor(window.innerWidth / 50));
      for (let i = 0; i < particleCount; i++) {
        const p = new Particle();
        p.y = Math.random() * canvas.height;
        particles.push(p);
      }
    }

    init();

    // Animation loop
    let frameCount = 0;
    function animate() {
      if (!isVisible) {
        animationId = requestAnimationFrame(animate);
        return;
      }

      frameCount++;
      // Render every 2nd frame for performance
      if (frameCount % 2 === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
          p.update();
          p.draw();
        });
      }

      animationId = requestAnimationFrame(animate);
    }

    animate();

    // Visibility handling
    document.addEventListener('visibilitychange', () => {
      isVisible = document.visibilityState === 'visible';
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      cancelAnimationFrame(animationId);
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
    });

    mobileNav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        toggle.classList.remove('active');
        mobileNav.classList.remove('show');
      });
    });

    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !mobileNav.contains(e.target)) {
        toggle.classList.remove('active');
        mobileNav.classList.remove('show');
      }
    });
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
