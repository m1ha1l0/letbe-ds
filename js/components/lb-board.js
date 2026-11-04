/* lb-board.js — LB.Board (kanban board vocabulary; self-registers via
 * LB.register). The projection model: columns are values of a field —
 * the board owns ZERO data, the DOM is the state, and every mutation
 * dispatches `lb-board-move` {card, from, to, index} so the consumer
 * writes it back to their store.
 *
 * Menu-move FIRST: every card gets a kebab menu with "Move to <column>"
 * entries — the single-pointer non-drag path WCAG 2.5.7 requires
 * (keyboard alone does not satisfy it). Pointer drag layers on top as
 * progressive enhancement. Counts in column headers self-maintain.
 */
(function () {
  'use strict';

  class Board {
    constructor(el, options = {}) {
      this.el = el;
      this.options = options;
      this._announcer = null;
      this._initAnnouncer();
      this.refresh();

      // Delegated menu-move: kebab menus are (re)built per card in
      // refresh(); clicks resolve through the data attributes.
      this._onClick = (e) => {
        const item = e.target.closest('[data-lb-board-move-to]');
        if (!item || !this.el.contains(item)) return;
        const card = item.closest('[data-lb-board-card]');
        const target = this.columns().find(
          (c) => this.columnName(c) === item.dataset.lbBoardMoveTo
        );
        if (card && target) this.moveCard(card, target);
      };
      this.el.addEventListener('click', this._onClick);
      // Capture runs before LB.Menu opens the panel from the trigger.
      // Rebuilding the move group here also picks up a lane rename or a
      // switch to/from .lb-board--stacked (the arrows' direction).
      this._onKebabOpen = (e) => {
        const trigger = e.target.closest && e.target.closest('.lb-board__card-kebab .lb-menu__trigger');
        if (!trigger || !this.el.contains(trigger)) return;
        const card = trigger.closest('[data-lb-board-card]');
        const col = card && card.closest('[data-lb-board-column]');
        if (card && col && trigger.getAttribute('aria-expanded') !== 'true') {
          this._ensureKebab(card, this.columns().map((c) => this.columnName(c)), this.columnName(col));
        }
      };
      this.el.addEventListener('click', this._onKebabOpen, true);
      this._enableDrag();

      // Keyboard grab-and-move (dnd-kit convention: Space/Enter picks
      // up, arrows move, Space/Enter drops, Escape cancels+restores).
      // Focus rides the card element through every move; each step is
      // announced. Cards need tabindex="0" in markup.
      this._grabbed = null;
      this._onKeydown = (e) => {
        const card = e.target.closest && e.target.closest('[data-lb-board-card]');
        if (!card || e.target !== card) return;
        const title = (card.querySelector('.lb-board__card-title') || {}).textContent || 'Card';
        if ((e.key === ' ' || e.key === 'Enter') && !this._grabbed) {
          e.preventDefault();
          const col = card.closest('[data-lb-board-column]');
          this._grabbed = { card, fromCol: col, fromIndex: this.cards(col).indexOf(card) };
          card.classList.add('lb-board__card--grabbed');
          this.announce(title + ' grabbed. Arrow keys move, Space drops, Escape cancels.');
          return;
        }
        if (!this._grabbed || this._grabbed.card !== card) return;
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          const toCol = card.closest('[data-lb-board-column]');
          const index = this.cards(toCol).indexOf(card);
          const fromName = this.columnName(this._grabbed.fromCol);
          card.classList.remove('lb-board__card--grabbed');
          const moved = toCol !== this._grabbed.fromCol || index !== this._grabbed.fromIndex;
          this._grabbed = null;
          if (moved) {
            this.refresh();
            this.el.dispatchEvent(new CustomEvent('lb-board-move', {
              bubbles: true,
              detail: { card, from: fromName, to: this.columnName(toCol), index },
            }));
            card.focus();
          }
          this.announce(title + ' dropped in ' + this.columnName(toCol) + ', position ' + (index + 1) + '.');
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          const g = this._grabbed;
          const body = this.columnBody(g.fromCol);
          const siblings = this.cards(g.fromCol).filter((c) => c !== card);
          if (g.fromIndex >= siblings.length) body.appendChild(card);
          else body.insertBefore(card, siblings[g.fromIndex]);
          card.classList.remove('lb-board__card--grabbed');
          this._grabbed = null;
          this.refresh();
          card.focus();
          this.announce('Move cancelled. ' + title + ' returned.');
          return;
        }
        if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          const col = card.closest('[data-lb-board-column]');
          const cols = this.columns();
          const ci = cols.indexOf(col);
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const target = cols[ci + (e.key === 'ArrowRight' ? 1 : -1)];
            if (!target) return;
            const body = this.columnBody(target);
            const idx = Math.min(this.cards(col).indexOf(card), this.cards(target).length);
            const sibs = this.cards(target);
            if (idx >= sibs.length) body.appendChild(card);
            else body.insertBefore(card, sibs[idx]);
          } else {
            const dir = e.key === 'ArrowDown' ? 1 : -1;
            const sibs = this.cards(col).filter((c) => c !== card);
            const cur = this.cards(col).indexOf(card);
            const next = cur + dir;
            if (next < 0 || next > sibs.length) {
              // Stacked lanes sit one under the other: past the first or
              // last card, ↑↓ carry the card into the lane above or below.
              if (!this.el.classList.contains('lb-board--stacked')) return;
              const cols = this.columns();
              const target = cols[cols.indexOf(col) + dir];
              if (!target) return;
              const tb = this.columnBody(target);
              if (dir > 0) tb.insertBefore(card, this.cards(target)[0] || null);
              else tb.appendChild(card);
            } else {
              const body = this.columnBody(col);
              if (next >= sibs.length) body.appendChild(card);
              else body.insertBefore(card, sibs[next]);
            }
          }
          this.refresh();
          card.focus();
          const nowCol = card.closest('[data-lb-board-column]');
          this.announce(title + ', ' + this.columnName(nowCol) + ', position ' + (this.cards(nowCol).indexOf(card) + 1) + ' of ' + this.cards(nowCol).length + '.');
        }
      };
      this.el.addEventListener('keydown', this._onKeydown);
    }

    /* Pointer drag — progressive enhancement over menu-move, following
       the playlist-reorder house pattern: the LIVE card moves under the
       pointer (the card IS the drop preview, no ghost/placeholder
       needed), with two-axis edge auto-scroll (board rail x + hovered
       column body y, two LB.edgeAutoScroll instances). Mouse/pen only:
       touch keeps native scrolling and uses the kebab menu-move (its
       WCAG 2.5.7 role); long-press touch drag is a future slice. */
    _enableDrag() {
      const LBg = window.LB;
      const scrollParentY = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const oy = getComputedStyle(p).overflowY;
          if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
        }
        return document.scrollingElement;
      };
      if (!LBg || !LBg.pointerDrag || !LBg.edgeAutoScroll) return;

      const columnAt = (x, y) => this.columns().find((c) => {
        const r = c.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      });

      const evaluateDrop = (x, y, card) => {
        const col = columnAt(x, y);
        if (!col) return;
        const body = this.columnBody(col);
        const siblings = this.cards(col).filter((c) => c !== card);
        let placed = false;
        for (const sib of siblings) {
          const r = sib.getBoundingClientRect();
          if (y < r.top + r.height / 2) {
            if (sib.previousElementSibling !== card) body.insertBefore(card, sib);
            placed = true;
            break;
          }
        }
        if (!placed && body.lastElementChild !== card) body.appendChild(card);
        return col;
      };

      LBg.pointerDrag(this.el, {
        onStart: (e, ctx) => {
          if (e.pointerType === 'touch') return false;
          // Controls and editable text on a card keep their own pointer
          // behaviour (caret, selection, open) instead of starting a drag.
          if (e.target.closest('button, a, input, textarea, select, label, [contenteditable]:not([contenteditable="false"]), .lb-menu-wrapper')) return false;
          const card = e.target.closest('[data-lb-board-card]');
          if (!card || !this.el.contains(card)) return false;
          ctx.card = card;
          ctx.fromName = this.columnName(card.closest('[data-lb-board-column]'));
          ctx.lastX = e.clientX;
          ctx.lastY = e.clientY;
          card.classList.add('lb-board__card--dragging');
          const reEval = () => { if (ctx.card) evaluateDrop(ctx.lastX, ctx.lastY, ctx.card); };
          ctx.railAuto = LBg.edgeAutoScroll({ scroller: this.el, axis: 'x', onTick: reEval });
          ctx.bodyAuto = LBg.edgeAutoScroll({ onTick: reEval });
          // Stacked lanes grow instead of scrolling: the panel or page
          // around the board is what scrolls near the top/bottom edge.
          ctx.stacked = this.el.classList.contains('lb-board--stacked');
          if (ctx.stacked) ctx.bodyAuto.setScroller(scrollParentY(this.el));
        },
        onMove: (e, ctx) => {
          if (!ctx.card) return;
          ctx.lastX = e.clientX;
          ctx.lastY = e.clientY;
          const col = evaluateDrop(e.clientX, e.clientY, ctx.card);
          ctx.railAuto.update(e.clientX, e.clientY);
          if (col && !ctx.stacked) ctx.bodyAuto.setScroller(this.columnBody(col));
          ctx.bodyAuto.update(e.clientX, e.clientY);
        },
        onEnd: (e, ctx) => {
          if (!ctx.card) return;
          ctx.card.classList.remove('lb-board__card--dragging');
          ctx.railAuto.stop();
          ctx.bodyAuto.stop();
          const toCol = ctx.card.closest('[data-lb-board-column]');
          const toName = this.columnName(toCol);
          const index = this.cards(toCol).indexOf(ctx.card);
          this.refresh();
          this.el.dispatchEvent(new CustomEvent('lb-board-move', {
            bubbles: true,
            detail: { card: ctx.card, from: ctx.fromName, to: toName, index },
          }));
          this.announce(
            (ctx.card.querySelector('.lb-board__card-title') || {}).textContent
            + ' moved to ' + toName + ', position ' + (index + 1)
          );
          ctx.card = null;
        },
      });
    }

    columns() {
      return Array.from(this.el.querySelectorAll('[data-lb-board-column]'));
    }

    columnName(col) {
      return col.dataset.lbBoardColumn
        || (col.querySelector('.lb-board__column-title') || {}).textContent
        || '';
    }

    columnBody(col) {
      return col.querySelector('.lb-board__column-body') || col;
    }

    cards(col) {
      return Array.from(this.columnBody(col).querySelectorAll('[data-lb-board-card]'));
    }

    /* Move a card to a column (append, or at index). The ONLY mutation
       path — menu, drag and keyboard all funnel here so the event
       contract stays single-sourced. */
    moveCard(card, targetCol, index = null) {
      const fromCol = card.closest('[data-lb-board-column]');
      const body = this.columnBody(targetCol);
      const siblings = this.cards(targetCol).filter((c) => c !== card);
      if (index === null || index >= siblings.length) body.appendChild(card);
      else body.insertBefore(card, siblings[index]);
      this.refresh();
      const detail = {
        card,
        from: fromCol ? this.columnName(fromCol) : null,
        to: this.columnName(targetCol),
        index: this.cards(targetCol).indexOf(card),
      };
      this.el.dispatchEvent(new CustomEvent('lb-board-move', { bubbles: true, detail }));
      this.announce(
        (card.querySelector('.lb-board__card-title') || {}).textContent
        + ' moved to ' + detail.to + ', position ' + (detail.index + 1)
      );
      return detail;
    }

    /* Re-sync derived chrome: column counts + per-card kebab move menus.
       Call after adding/removing cards or columns externally. */
    refresh() {
      const cols = this.columns();
      const names = cols.map((c) => this.columnName(c));
      cols.forEach((col) => {
        const count = col.querySelector('[data-lb-board-count]');
        if (count) {
          const n = this.cards(col).length;
          // Advisory WIP limit — communicate, never block:
          // data-lb-board-wip="4" renders "n/4" and flips the badge to
          // the warning tone only while over.
          const wip = parseInt(col.dataset.lbBoardWip, 10);
          if (wip) {
            count.textContent = n + '/' + wip;
            count.classList.toggle('lb-badge--warning', n > wip);
            count.classList.toggle('lb-badge--default', n <= wip);
          } else {
            count.textContent = n;
          }
        }
        this.cards(col).forEach((card) => this._ensureKebab(card, names, this.columnName(col)));
      });
    }

    /* The card menu: the board owns only its "Move to" group (marked
       data-lb-board-own) and rebuilds it on every refresh. Items a page
       puts in the same menu, in markup or later, are kept after a
       separator; LB.Menu delegates item clicks, so they select and
       close like the move items (listen for lb-menu-select). Arrows say
       where the card goes: left/right, or up/down on a stacked board. */
    _ensureKebab(card, names, currentName) {
      let wrap = card.querySelector('.lb-board__card-kebab');
      if (!wrap) {
        const row = card.querySelector('.lb-board__card-row') || card;
        wrap = document.createElement('div');
        wrap.className = 'lb-menu-wrapper lb-board__card-kebab';
        wrap.setAttribute('data-lb-menu', '');
        wrap.innerHTML =
          '<button type="button" class="lb-menu__trigger lb-icon-btn lb-icon-btn--ghost lb-icon-btn--small" aria-label="Card actions">'
          + '<span class="lb-icon-btn__icon" aria-hidden="true" data-lb-icon="more-vertical"></span></button>'
          + '<ul class="lb-menu lb-list"></ul>';
        row.appendChild(wrap);
      }
      const menu = wrap.querySelector('ul.lb-menu');
      menu.querySelectorAll(':scope > [data-lb-board-own]').forEach((li) => li.remove());
      const stacked = this.el.classList.contains('lb-board--stacked');
      const from = names.indexOf(currentName);
      const moves = names
        .filter((n) => n !== currentName)
        .map((n) => {
          const back = names.indexOf(n) < from;
          const icon = stacked ? (back ? 'arrow-up' : 'arrow-down') : (back ? 'arrow-left' : 'arrow-right');
          return '<li data-lb-board-own><button type="button" class="lb-list__item" data-lb-board-move-to="' + n + '">'
            + '<span class="lb-list__icon" aria-hidden="true" data-lb-icon="' + icon + '"></span>'
            + '<span class="lb-list__label">Move to ' + n + '</span></button></li>';
        }).join('');
      menu.insertAdjacentHTML('afterbegin', moves);
      this._syncSeparator(menu);
      if (window.LB) {
        if (window.LB.init) window.LB.init(wrap.parentElement || wrap);
        if (window.LB.initIcons) window.LB.initIcons(wrap);
      }
    }

    // One separator between the move group and the page's own items,
    // only while there are page items. Re-checked as the menu opens, so
    // items a page appends after a refresh get it too.
    _syncSeparator(menu) {
      const sep = menu.querySelector(':scope > .lb-list__separator[data-lb-board-own]');
      const hasPageItems = Array.from(menu.children).some((li) => !li.hasAttribute('data-lb-board-own'));
      if (hasPageItems && !sep) {
        const lastMove = Array.from(menu.querySelectorAll(':scope > [data-lb-board-own]')).pop();
        const html = '<li class="lb-list__separator" role="separator" data-lb-board-own></li>';
        if (lastMove) lastMove.insertAdjacentHTML('afterend', html);
        else menu.insertAdjacentHTML('afterbegin', html);
      } else if (!hasPageItems && sep) {
        sep.remove();
      }
    }

    /* Polite live region — move results are announced for AT (there is
       no ARIA DnD vocabulary; authored announcements are the pattern). */
    _initAnnouncer() {
      this._announcer = document.createElement('div');
      this._announcer.className = 'lb-visually-hidden';
      this._announcer.setAttribute('aria-live', 'polite');
      this.el.appendChild(this._announcer);
    }

    announce(msg) {
      if (!this._announcer) return;
      this._announcer.textContent = '';
      requestAnimationFrame(() => { this._announcer.textContent = msg; });
    }

    destroy() {
      this.el.removeEventListener('click', this._onClick);
      this.el.removeEventListener('click', this._onKebabOpen, true);
      this.el.removeEventListener('keydown', this._onKeydown);
      if (this._announcer) this._announcer.remove();
      if (this.el._lbBoard === this) delete this.el._lbBoard;
    }
  }

  if (window.LB && window.LB.register) {
    window.LB.register('board', Board, '[data-lb-board]');
  }
})();
