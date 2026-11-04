/* ─────────────────────────────────────────────────────────────
 * LB.Lightbox — image viewer built on LB.Modal (opt-in module)
 * ─────────────────────────────────────────────────────────────
 * Load js/lb.js first, then this file. Any <a href="image" data-lb-lightbox>
 * opens in a modal image viewer instead of navigating. A video link
 * (mp4, webm, ogv, mov, m4v — or any href with data-lb-type="video")
 * opens in the same viewer as a muted, looping <video controls
 * playsinline>, sized like an image, playing while it is shown (not
 * under reduced motion) and paused on step and close. Everything is the
 * canonical lb-modal anatomy — backdrop, dialog, header, body, footer —
 * with lightbox chrome on top; LB.Modal owns open/close, focus trap,
 * scroll lock, Esc and backdrop-click.
 *
 * What it does:
 *   - Grouped navigation: prev/next buttons + ←/→ arrow keys walk the
 *     group, wrapping at the ends; a 1-of-N counter sits in the footer.
 *     The group is: links sharing this link's data-lb-lightbox VALUE
 *     (e.g. data-lb-lightbox="press") — or, for bare attributes, the
 *     links inside the closest [data-lb-gallery] container — or, with
 *     neither, every bare data-lb-lightbox link on the page.
 *   - Caption: headline + optional subline under the header title.
 *     Sources, in order: data-lb-caption (+ data-lb-caption-sub) on the
 *     link, the closest <figure>'s <figcaption>, the thumbnail's alt.
 *   - The dialog hugs the image: each step sizes the <img> explicitly to
 *     the largest fit inside the viewport caps (mirrored in the
 *     .lb-lightbox CSS), so the chrome wraps the picture instead of
 *     letterboxing it; neighbours are preloaded, a resize refits the
 *     current image, and a link's image is prefetched as soon as it is
 *     hovered, touched or focused.
 *   - Motion (all of it skipped under prefers-reduced-motion): opening,
 *     the backdrop fades in while the frame waits unseen for the photo
 *     (at most 4s), then the frame rises in at its final size and the
 *     photo fades in inside it; between images the old one fades out
 *     fast, the frame glides to the new size, and the new one fades in
 *     and settles with its caption and count; closing is the Modal exit.
 *   - Swipe on touch screens: a mostly sideways move of 50px (or a quick
 *     flick) steps, the image follows the finger; touches from the
 *     screen edges (system back gestures), second fingers and a zoomed
 *     page are left alone, vertical scroll and pinch stay the browser's
 *     (touch-action: pan-y pinch-zoom). The arrows stay.
 *   - Full screen on phones (the CSS ≤640px block), blurred backdrop.
 *
 * Modifier clicks (cmd/ctrl/shift/middle) fall through to the browser so
 * open-in-new-tab keeps working. The engine boundary: this is chrome +
 * state only — images are plain <a href>/<img>, no loader, no zoom
 * library; bring your own if you need one.
 */
(function () {
  'use strict';
  if (!window.LB) { console.warn('[letbe-ds] lb-lightbox.js needs js/lb.js loaded first.'); return; }

  const SEL = 'a[data-lb-lightbox]';
  const IMG_RE = /\.(avif|webp|jpe?g|png|gif|svg)(\?.*)?$/i;
  const VIDEO_RE = /\.(mp4|webm|ogv|mov|m4v)(\?.*)?$/i;
  const isVideo = (a) => a.getAttribute('data-lb-type') === 'video' || VIDEO_RE.test(a.getAttribute('href') || '');
  const isMedia = (a) => isVideo(a) || IMG_RE.test(a.getAttribute('href') || '');

  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  function tokenMs(token) {
    if (reduced()) return 0;
    const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    return (v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000) || 0;
  }

  class Lightbox {
    constructor() {
      this._items = [];
      this._index = 0;
      this._switching = 0;
      this._open = false;
      this._swipe = null;
      this._build();
    }

    _build() {
      const host = document.createElement('div');
      host.innerHTML =
        '<div class="lb-modal-backdrop lb-lightbox" data-lb-modal style="display:none;" role="dialog" aria-modal="true" aria-labelledby="lb-lightbox-title">' +
          '<div class="lb-modal lb-modal--large lb-lightbox__dialog">' +
            '<div class="lb-modal__header">' +
              '<div class="lb-modal__header-title lb-lightbox__titles">' +
                '<h3 class="lb-modal__title" id="lb-lightbox-title"></h3>' +
                '<p class="lb-lightbox__sub"></p>' +
              '</div>' +
              '<button class="lb-icon-btn lb-icon-btn--ghost lb-icon-btn--medium lb-modal__close" type="button" aria-label="Close"><span data-lb-icon="x"></span></button>' +
            '</div>' +
            '<div class="lb-modal__body lb-lightbox__body"><img class="lb-lightbox__img" alt=""><video class="lb-lightbox__video" muted loop playsinline controls preload="metadata" hidden></video></div>' +
            '<div class="lb-modal__footer lb-lightbox__footer">' +
              '<span class="lb-lightbox__count" aria-live="polite"></span>' +
              '<span class="lb-lightbox__nav">' +
                '<button class="lb-icon-btn lb-icon-btn--ghost lb-icon-btn--medium" type="button" data-lb-lightbox-prev aria-label="Previous image"><span data-lb-icon="chevron-left"></span></button>' +
                '<button class="lb-icon-btn lb-icon-btn--ghost lb-icon-btn--medium" type="button" data-lb-lightbox-next aria-label="Next image"><span data-lb-icon="chevron-right"></span></button>' +
              '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      this.el = host.firstChild;
      document.body.appendChild(this.el);
      if (LB.initIcons) LB.initIcons(this.el);

      this._img = this.el.querySelector('.lb-lightbox__img');
      this._video = this.el.querySelector('.lb-lightbox__video');
      this._media = this._img; // the element on show: image or video
      this._title = this.el.querySelector('#lb-lightbox-title');
      this._sub = this.el.querySelector('.lb-lightbox__sub');
      this._count = this.el.querySelector('.lb-lightbox__count');
      this._nav = this.el.querySelector('.lb-lightbox__nav');

      this.el.querySelector('[data-lb-lightbox-prev]').addEventListener('click', () => this.show(this._index - 1));
      this.el.querySelector('[data-lb-lightbox-next]').addEventListener('click', () => this.show(this._index + 1));

      // open-state tracked via Modal's own events — never its inline styles
      this.el.addEventListener('lb-modal-open', () => { this._open = true; });
      this.el.addEventListener('lb-modal-close', () => { this._open = false; this._video.pause(); });

      this._onKey = (e) => {
        if (!this._open) return;
        if (document.activeElement === this._video) return; // arrows seek the video
        if (e.key === 'ArrowRight') this.show(this._index + 1);
        if (e.key === 'ArrowLeft') this.show(this._index - 1);
      };
      document.addEventListener('keydown', this._onKey);

      this._bindSwipe(this.el.querySelector('.lb-lightbox__body'));

      let t;
      this._onResize = () => {
        if (!this._open) return;
        clearTimeout(t);
        t = setTimeout(() => this.show(this._index, true), 120);
      };
      window.addEventListener('resize', this._onResize);
    }

    _caption(link) {
      const head = link.getAttribute('data-lb-caption');
      if (head) return { head, sub: link.getAttribute('data-lb-caption-sub') || '' };
      const fig = link.closest('figure');
      const cap = fig && fig.querySelector('figcaption');
      if (cap) return { head: cap.textContent.trim(), sub: link.getAttribute('data-lb-caption-sub') || '' };
      const im = link.querySelector('img');
      return { head: (im && im.alt) || '', sub: '' };
    }

    _group(link) {
      const name = link.getAttribute('data-lb-lightbox');
      let links;
      if (name) links = document.querySelectorAll(`a[data-lb-lightbox="${CSS.escape(name)}"]`);
      else {
        const scope = link.closest('[data-lb-gallery]') || document;
        links = Array.from(scope.querySelectorAll(SEL)).filter((a) => !a.getAttribute('data-lb-lightbox'));
      }
      return Array.from(links).filter(isMedia).map((a) => {
        const c = this._caption(a);
        const im = a.querySelector('img');
        return {
          href: a.getAttribute('href'), alt: (im && im.alt) || c.head, head: c.head, sub: c.sub,
          video: isVideo(a), poster: a.getAttribute('data-lb-poster') || (im && (im.currentSrc || im.src)) || '',
        };
      });
    }

    // Largest size for a natural w×h inside the viewport caps. The
    // numbers mirror the .lb-lightbox CSS: dialog max-width
    // min(96vw, 90rem) minus ~3rem chrome; height minus ~14rem of
    // header/footer chrome (11rem in the ≤640px full-screen layout).
    _fit(natW, natH) {
      const vw = window.innerWidth, vh = window.innerHeight, r = rem();
      const mobile = vw <= 640;
      const maxW = mobile ? vw : Math.min(vw * 0.96, 90 * r) - 3 * r;
      const maxH = mobile ? vh - 11 * r : vh - 14 * r;
      const s = Math.min(maxW / natW, maxH / natH, 1);
      return { w: Math.round(natW * s), h: Math.round(natH * s) };
    }

    _load(it) {
      return new Promise((resolve) => {
        if (it.video) {
          // Only the metadata: the frame needs the video's own size.
          const v = document.createElement('video');
          v.preload = 'metadata';
          v.muted = true;
          v.onloadedmetadata = () => resolve({ w: v.videoWidth || 1600, h: v.videoHeight || 900 });
          v.onerror = () => resolve({ w: 1600, h: 900 });
          v.src = it.href;
          return;
        }
        const p = new Image();
        p.onload = () => resolve({ w: p.naturalWidth, h: p.naturalHeight });
        p.onerror = () => resolve({ w: 1600, h: 1000 }); // broken image: a sane frame, alt text shows
        p.src = it.href;
      });
    }

    // Swipe — pointer events on the stage. The browser keeps vertical
    // pans and pinch (touch-action: pan-y pinch-zoom in the CSS), so a
    // sideways move reaches us; we decide after ~10px which way it goes.
    _bindSwipe(stage) {
      const EDGE = 24, MIN = 50, FLICK = 0.5; // px, px, px/ms
      const zoomed = () => window.visualViewport && window.visualViewport.scale > 1.01;
      const reset = () => {
        this.el.classList.remove('lb-lightbox--dragging');
        this._media.style.translate = '';
        this._swipe = null;
      };
      stage.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' || this._items.length < 2) return;
        if (this._swipe) { reset(); return; } // a second finger: not a swipe
        if (!e.isPrimary || zoomed() || e.clientX < EDGE || e.clientX > window.innerWidth - EDGE) return;
        // A video's control bar (seek, volume) keeps its own drags.
        if (this._media === this._video && e.clientY > this._video.getBoundingClientRect().bottom - 56) return;
        this._swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, dx: 0, axis: null };
      });
      stage.addEventListener('pointermove', (e) => {
        const sw = this._swipe;
        if (!sw || e.pointerId !== sw.id) return;
        sw.dx = e.clientX - sw.x;
        const dy = e.clientY - sw.y;
        if (!sw.axis && (Math.abs(sw.dx) > 10 || Math.abs(dy) > 10)) {
          sw.axis = Math.abs(sw.dx) > Math.abs(dy) ? 'x' : 'y';
          if (sw.axis === 'y') { reset(); return; }
          if (!reduced()) this.el.classList.add('lb-lightbox--dragging');
        }
        if (sw.axis === 'x' && !reduced()) this._media.style.translate = sw.dx + 'px 0';
      });
      const end = (e) => {
        const sw = this._swipe;
        if (!sw || e.pointerId !== sw.id) return;
        const v = Math.abs(sw.dx) / Math.max(1, e.timeStamp - sw.t);
        const step = e.type === 'pointerup' && sw.axis === 'x' && (Math.abs(sw.dx) >= MIN || (Math.abs(sw.dx) > 20 && v > FLICK));
        this.el.classList.remove('lb-lightbox--dragging'); // snap back animates
        if (step) this.show(this._index + (sw.dx < 0 ? 1 : -1));
        else this._media.style.translate = '';
        this._swipe = null;
      };
      stage.addEventListener('pointerup', end);
      stage.addEventListener('pointercancel', end);
    }

    _place(it, size) {
      const m = it.video ? this._video : this._img;
      const other = it.video ? this._img : this._video;
      other.hidden = true;
      other.style.translate = '';
      if (other === this._video && this._video.getAttribute('src')) { this._video.pause(); this._video.removeAttribute('src'); this._video.load(); }
      m.hidden = false;
      m.style.translate = '';
      m.style.width = size.w + 'px';
      m.style.height = size.h + 'px';
      if (it.video) {
        if (this._video.getAttribute('src') !== it.href) {
          this._video.poster = it.poster;
          this._video.src = it.href;
        }
        this._video.setAttribute('aria-label', it.alt || it.head || '');
        if (!reduced()) { const pr = this._video.play(); if (pr && pr.catch) pr.catch(() => {}); }
      } else {
        this._img.src = it.href;
        this._img.alt = it.alt;
      }
      this._media = m;
      this._title.textContent = it.head;
      this._sub.textContent = it.sub;
      this._sub.hidden = !it.sub;
      this._count.textContent = `${this._index + 1} of ${this._items.length}`;
    }

    // Placement without the size glide (first image of an opening, refit
    // on resize): the transition is off for this one frame.
    _placeInstant(it, size) {
      this._img.style.transition = this._video.style.transition = 'none';
      this._place(it, size);
      void this._media.offsetWidth;
      this._img.style.transition = this._video.style.transition = '';
      this.el.classList.remove('lb-lightbox--switching');
    }

    // onPlaced (opening only): called once the frame can show — when the
    // photo has loaded, or after 4s with a stand-in frame (the real size
    // then glides in when the photo arrives).
    show(i, instant, onPlaced) {
      if (!this._items.length) return;
      this._index = (i + this._items.length) % this._items.length;
      const it = this._items[this._index];
      const ticket = ++this._switching;
      if (!instant) this._video.pause();
      const loading = this._load(it);
      if (onPlaced) {
        let placed = false;
        const guard = setTimeout(() => {
          if (ticket !== this._switching || placed) return;
          placed = true;
          this._placeInstant(it, this._fit(1600, 1000));
          onPlaced();
        }, 4000);
        loading.then((nat) => {
          clearTimeout(guard);
          if (ticket !== this._switching) return;
          const size = this._fit(nat.w, nat.h);
          if (placed) { this._place(it, size); return; }
          placed = true;
          this._placeInstant(it, size);
          onPlaced();
        });
      } else {
        loading.then((nat) => {
          if (ticket !== this._switching) return;
          const size = this._fit(nat.w, nat.h);
          if (instant || reduced()) { this._placeInstant(it, size); return; }
          // Old image and caption fade out fast, the frame glides to the
          // new size, the new image fades in and settles half-way through.
          this.el.classList.add('lb-lightbox--switching');
          setTimeout(() => {
            if (ticket !== this._switching) return;
            this._place(it, size);
            setTimeout(() => {
              if (ticket === this._switching) this.el.classList.remove('lb-lightbox--switching');
            }, tokenMs('--lb-animation-dur-slow') / 2);
          }, tokenMs('--lb-animation-dur-normal'));
        });
      }
      // warm the neighbours (images only — videos load when shown)
      if (this._items.length > 1) {
        [1, -1].forEach((d) => {
          const n = this._items[(this._index + d + this._items.length) % this._items.length];
          if (!n.video) { const p = new Image(); p.src = n.href; }
        });
      }
    }

    open(link) {
      this._items = this._group(link);
      if (!this._items.length) return;
      const href = link.getAttribute('href');
      const start = this._items.findIndex((it) => it.href === href);
      this._nav.hidden = this._items.length < 2;
      // The frame stays unseen (--loading) until the photo is in place,
      // then rises in at its final size and the photo fades in after it.
      const motion = !reduced();
      if (motion) this.el.classList.add('lb-lightbox--loading');
      this.show(start < 0 ? 0 : start, true, () => {
        if (!motion) return;
        this.el.classList.remove('lb-lightbox--loading');
        this.el.classList.add('lb-lightbox--revealing');
        void this._media.offsetWidth;
        setTimeout(() => this.el.classList.remove('lb-lightbox--revealing'), tokenMs('--lb-animation-dur-gentle'));
      });
      LB.Modal.open(this.el);
    }

    destroy() {
      document.removeEventListener('keydown', this._onKey);
      window.removeEventListener('resize', this._onResize);
      this.el.remove();
    }
  }

  // Singleton chrome, built lazily on first open.
  let _instance = null;
  function instance() {
    if (!_instance) _instance = new Lightbox();
    return _instance;
  }

  // Prefetch: warm a link's image as soon as it is hovered, touched or
  // focused, so the viewer usually opens on a cached photo.
  const warmed = new Set();
  const warm = (e) => {
    const link = e.target.closest && e.target.closest(SEL);
    const href = link && link.getAttribute('href');
    if (!href || warmed.has(href) || !IMG_RE.test(href)) return;
    warmed.add(href);
    const p = new Image(); p.src = href;
  };
  document.addEventListener('pointerover', warm, { passive: true });
  document.addEventListener('touchstart', warm, { passive: true });
  document.addEventListener('focusin', warm);

  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest(SEL);
    if (!link || !isMedia(link)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    instance().open(link);
  });

  // ─── PUBLIC API + SELF-REGISTRATION ────────────────────────
  // Programmatic surface: LB.Lightbox.open(linkEl). No auto-init
  // selector — the viewer is a delegated singleton, not per-element.
  LB.Lightbox = { open: (link) => instance().open(link), instance };
  if (LB.register) LB.register('lightbox', Lightbox);
})();
