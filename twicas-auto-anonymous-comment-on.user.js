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

  const DEBUG = false;
  const MAX_TRIES = 20;
  const INTERVAL_MS = 700;

  let tries = 0;
  let timer = null;
  let working = false;

  function log(...args) {
    if (DEBUG) console.log('[Twicas Auto Anonymous]', ...args);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function getCommentApp() {
    return document.querySelector('#comment-list-app');
  }

  function isAnonymousAllowed() {
    const app = getCommentApp();

    if (!app) return true;

    if (app.dataset.isAnonymousCommentAllowed === 'false') {
      log('この枠は匿名コメント不可');
      return false;
    }

    return true;
  }

  function findMenuButton() {
    const buttons = Array.from(document.querySelectorAll('button'));

    return buttons.find((button) => {
      const label = button.getAttribute('aria-label') || '';
      const classes = button.className || '';

      return (
        label.includes('その他') ||
        classes.includes('tw-comment-post-menu-others') ||
        classes.includes('tw-button-borderless')
      );
    });
  }

  function findAnonymousOnItem() {
    const items = Array.from(document.querySelectorAll('a, button'));

    return items.find((el) => {
      const text = (el.textContent || '').trim();
      return text === '匿名コメントをONにする';
    });
  }

  function findAnonymousOffItem() {
    const items = Array.from(document.querySelectorAll('a, button'));

    return items.find((el) => {
      const text = (el.textContent || '').trim();
      return text === '匿名コメントをOFFにする';
    });
  }

  function closeMenuQuietly() {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      bubbles: true
    }));
  }

  function tryEnableAnonymous() {
    if (working) return;

    if (!isAnonymousAllowed()) {
      stop();
      return;
    }

    working = true;

    const alreadyOn = findAnonymousOffItem();
    if (alreadyOn) {
      log('匿名コメントは既にON');
      closeMenuQuietly();
      stop();
      working = false;
      return;
    }

    const menuButton = findMenuButton();

    if (!menuButton) {
      log('三点メニューボタンが見つからない');
      working = false;
      return;
    }

    log('三点メニューを開く');
    menuButton.click();

    setTimeout(() => {
      const alreadyOnAfterOpen = findAnonymousOffItem();
      if (alreadyOnAfterOpen) {
        log('匿名コメントは既にON');
        closeMenuQuietly();
        stop();
        working = false;
        return;
      }

      const onItem = findAnonymousOnItem();

      if (!onItem) {
        log('匿名コメントON項目が見つからない');
        closeMenuQuietly();
        working = false;
        return;
      }

      log('匿名コメントをONにする');
      onItem.click();

      stop();
      working = false;
    }, 250);
  }

  timer = setInterval(() => {
    tries++;

    tryEnableAnonymous();

    if (tries >= MAX_TRIES) {
      log('最大試行回数に達したので終了');
      stop();
    }
  }, INTERVAL_MS);
})();
