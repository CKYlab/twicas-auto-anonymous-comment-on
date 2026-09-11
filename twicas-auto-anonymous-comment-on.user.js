// ==UserScript==
// @name         ツイキャス 匿名コメント自動ON
// @name:en      TwitCasting Auto Anonymous Comment ON
// @description  ツイキャスの配信ページで匿名コメントを自動でONにします。X投稿チェックは操作しません。
// @description:en Automatically enables anonymous comments on TwitCasting live pages. Does not touch the X post checkbox.
// @namespace    https://github.com/CKYlab/twicas-auto-anonymous-comment-on
// @version      0.1.3
// @license      MIT
// @match        https://twitcasting.tv/*
// @match        https://ja.twitcasting.tv/*
// @grant        none
// @run-at       document-idle
// @homepageURL  https://github.com/CKYlab/twicas-auto-anonymous-comment-on
// @supportURL   https://github.com/CKYlab/twicas-auto-anonymous-comment-on/issues
// ==/UserScript==

(() => {
  'use strict';

  if (window.top !== window.self) return;
  if (window.__twicasAutoAnonymousCommentOnRunning) return;
  window.__twicasAutoAnonymousCommentOnRunning = true;

  const MAX_TRIES = 30;
  const RETRY_MS = 700;
  const MENU_WAIT_MS = 300;
  const ITEM_RECHECK_COUNT = 5;
  const ITEM_RECHECK_MS = 150;

  const ON_TEXTS = [
    '匿名コメントをONにする',
    'Enable anonymous comments',
    '익명 댓글 활성화',
    '啟用匿名留言'
  ];

  const OFF_TEXTS = [
    '匿名コメントをOFFにする',
    'Disable anonymous comments',
    '익명 댓글 비활성화',
    '停用匿名留言'
  ];

  let tries = 0;
  let done = false;
  let working = false;

  const norm = (text) => (text || '').replace(/\s+/g, '').trim();

  const isVisible = (el) => {
    if (!el) return false;

    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.width > 0 &&
      rect.height > 0
    );
  };

  const getCommentForm = () => {
    return Array.from(document.querySelectorAll('form')).find((form) => {
      const textarea = form.querySelector('textarea');
      return textarea && isVisible(form) && isVisible(textarea);
    }) || null;
  };

  const getMenuWrap = () => {
    const form = getCommentForm();
    return form ? form.querySelector('.tw-comment-post-menu-others') : null;
  };

  const getMenuButton = () => {
    const wrap = getMenuWrap();
    return wrap ? wrap.querySelector('button') : null;
  };

  const getMenuTexts = () => {
    const wrap = getMenuWrap();
    if (!wrap) return [];

    return Array.from(wrap.querySelectorAll('a, button'))
      .filter(isVisible)
      .map((el) => norm(el.textContent))
      .filter(Boolean);
  };

  const findMenuItem = (texts) => {
    const wrap = getMenuWrap();
    if (!wrap) return null;

    const targets = texts.map(norm);

    return Array.from(wrap.querySelectorAll('a, button'))
      .filter(isVisible)
      .find((el) => targets.includes(norm(el.textContent))) || null;
  };

  const closeMenu = (button) => {
    if (button && button.getAttribute('aria-expanded') === 'true') {
      button.click();
      return;
    }

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      bubbles: true
    }));
  };

  const findAnonymousState = async () => {
    for (let i = 0; i < ITEM_RECHECK_COUNT; i++) {
      const offItem = findMenuItem(OFF_TEXTS);
      if (offItem) {
        return { state: 'already-on', item: offItem };
      }

      const onItem = findMenuItem(ON_TEXTS);
      if (onItem) {
        return { state: 'can-enable', item: onItem };
      }

      await new Promise((resolve) => setTimeout(resolve, ITEM_RECHECK_MS));
    }

    const menuTexts = getMenuTexts();

    if (menuTexts.length > 0) {
      return { state: 'unavailable', item: null };
    }

    return { state: 'not-ready', item: null };
  };

  const run = () => {
    if (done || working) return;

    tries++;

    const app = document.querySelector('#comment-list-app');
    if (app && app.dataset.isAnonymousCommentAllowed === 'false') {
      done = true;
      return;
    }

    const button = getMenuButton();

    if (!button) {
      if (tries < MAX_TRIES) setTimeout(run, RETRY_MS);
      return;
    }

    working = true;

    if (button.getAttribute('aria-expanded') !== 'true') {
      button.click();
    }

    setTimeout(async () => {
      const result = await findAnonymousState();

      if (result.state === 'already-on') {
        closeMenu(button);
        done = true;
        working = false;
        return;
      }

      if (result.state === 'can-enable') {
        result.item.click();

        setTimeout(() => {
          closeMenu(button);
          done = true;
          working = false;
        }, 300);

        return;
      }

      closeMenu(button);
      working = false;

      if (result.state === 'unavailable') {
        done = true;
        return;
      }

      if (tries < MAX_TRIES) {
        setTimeout(run, RETRY_MS);
      }
    }, MENU_WAIT_MS);
  };

  setTimeout(run, 1000);
})();
