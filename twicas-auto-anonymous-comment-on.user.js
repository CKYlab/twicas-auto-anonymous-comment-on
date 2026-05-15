// ==UserScript==
// @name         ツイキャス 匿名コメント自動ON
// @name:en      TwitCasting Auto Anonymous Comment ON
// @description  ツイキャスの配信ページで匿名コメントを自動でONにします。X投稿チェックは操作しません。
// @description:en Automatically enables anonymous comments on TwitCasting live pages. Does not touch the X post checkbox.
// @namespace    https://github.com/CKYlab/twicas-auto-anonymous-comment-on
// @version      0.1.0
// @license      MIT
// @match        https://twitcasting.tv/*
// @match        https://ja.twitcasting.tv/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // iframe内では動かさない
  if (window.top !== window.self) {
    return;
  }

  if (window.__twicasAutoAnonymousCommentOnRunning) {
    console.warn('[Twicas Auto Anonymous] already running. skipped.');
    return;
  }

  window.__twicasAutoAnonymousCommentOnRunning = true;

  const DEBUG = true;

  const MAX_TRIES = 30;
  const RETRY_MS = 700;
  const MENU_WAIT_MS = 500;

  const TEXT_ON = '匿名コメントをONにする';
  const TEXT_OFF = '匿名コメントをOFFにする';

  let tries = 0;
  let done = false;
  let working = false;

  function log(...args) {
    if (DEBUG) console.log('[Twicas Auto Anonymous]', ...args);
  }

  function normalizeText(text) {
    return (text || '').replace(/\s+/g, '').trim();
  }

  function isVisible(el) {
    if (!el) return false;

    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function clickOnce(el) {
    if (!el) return;
    el.click();
  }

  function isAnonymousAllowed() {
    const app = document.querySelector('#comment-list-app');

    if (app && app.dataset.isAnonymousCommentAllowed === 'false') {
      log('Anonymous comments are not allowed on this live.');
      return false;
    }

    return true;
  }

  function findCommentTextarea() {
    const textareas = Array.from(document.querySelectorAll('textarea'));

    return textareas.find((textarea) => {
      const placeholder = textarea.getAttribute('placeholder') || '';
      return isVisible(textarea) && placeholder.includes('コメント');
    }) || null;
  }

  function findCommentForm() {
    const textarea = findCommentTextarea();
    if (!textarea) return null;

    return textarea.closest('form');
  }

  function findCommentMenuWrap() {
    const form = findCommentForm();
    if (!form) return null;

    return form.querySelector('.tw-comment-post-menu-others');
  }

  function findCommentMenuButton() {
    const wrap = findCommentMenuWrap();
    if (!wrap) return null;

    return (
      wrap.querySelector('button[aria-label="その他"]') ||
      wrap.querySelector('button[aria-haspopup="true"]') ||
      wrap.querySelector('button')
    );
  }

  function findClickableTextItemInCommentMenu(text) {
    const wrap = findCommentMenuWrap();
    if (!wrap) return null;

    const target = normalizeText(text);

    // まず本命。クリックできる a / button だけを探す
    const clickableItems = Array.from(wrap.querySelectorAll('a, button'))
      .filter(isVisible);

    const direct = clickableItems.find((el) => {
      return normalizeText(el.textContent) === target;
    });

    if (direct) {
      log('direct clickable item found:', direct);
      return direct;
    }

    // 保険。li/spanに文字が入っていた場合、その中のa/buttonを返す
    const textHolders = Array.from(wrap.querySelectorAll('li, span'))
      .filter(isVisible);

    const holder = textHolders.find((el) => {
      return normalizeText(el.textContent) === target;
    });

    if (!holder) return null;

    const childClickable = holder.querySelector('a, button');
    if (childClickable) {
      log('child clickable item found:', childClickable);
      return childClickable;
    }

    const parentClickable = holder.closest('a, button');
    if (parentClickable) {
      log('parent clickable item found:', parentClickable);
      return parentClickable;
    }

    // li自体は原則クリックしない
    log('text found but no clickable element:', holder);
    return null;
  }

  function logMenuTexts() {
    const wrap = findCommentMenuWrap();

    if (!wrap) {
      log('comment menu wrap: null');
      return;
    }

    const texts = Array.from(wrap.querySelectorAll('a, button, li, span'))
      .map((el) => normalizeText(el.textContent))
      .filter(Boolean);

    log('comment menu texts:', texts);
  }

  function closeMenu(menuButton) {
    if (menuButton && menuButton.getAttribute('aria-expanded') === 'true') {
      clickOnce(menuButton);
      return;
    }

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      bubbles: true
    }));
  }

  function tryEnableAnonymous() {
    if (done || working) return;

    tries++;
    log('try:', tries);

    if (!isAnonymousAllowed()) {
      done = true;
      return;
    }

    const form = findCommentForm();
    log('comment form:', form);

    const menuButton = findCommentMenuButton();
    log('comment menu button:', menuButton);

    if (!menuButton) {
      if (tries < MAX_TRIES) {
        setTimeout(tryEnableAnonymous, RETRY_MS);
      }
      return;
    }

    working = true;

    log('opening comment menu. before expanded:', menuButton.getAttribute('aria-expanded'));

    if (menuButton.getAttribute('aria-expanded') !== 'true') {
      clickOnce(menuButton);
    }

    setTimeout(() => {
      log('after expanded:', menuButton.getAttribute('aria-expanded'));
      logMenuTexts();

      const offItem = findClickableTextItemInCommentMenu(TEXT_OFF);

      if (offItem) {
        log('anonymous already ON.');
        closeMenu(menuButton);
        done = true;
        working = false;
        return;
      }

      const onItem = findClickableTextItemInCommentMenu(TEXT_ON);

      if (!onItem) {
        log('anonymous ON item not found.');
        closeMenu(menuButton);
        working = false;

        if (tries < MAX_TRIES) {
          setTimeout(tryEnableAnonymous, RETRY_MS);
        }

        return;
      }

      log('click anonymous ON item:', onItem);
      clickOnce(onItem);

      setTimeout(() => {
        closeMenu(menuButton);
        done = true;
        working = false;
        log('finished.');
      }, 300);
    }, MENU_WAIT_MS);
  }

  setTimeout(tryEnableAnonymous, 1000);
})();
