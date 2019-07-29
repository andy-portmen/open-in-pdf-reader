'use strict';

function observe(e) {
  const a = e.target.closest('a');
  if (a) {
    let href = (a.href || '').toLowerCase();
    if (/google\.[^./]+\/url?/.test(href)) {
      const tmp = /url=([^&]+)/.exec(href);
      if (tmp && tmp.length) {
        href = decodeURIComponent(tmp[1]);
      }
    }
    href = href.toLowerCase();
    if (href.endsWith('.pdf') || href.indexOf('.pdf?') !== -1) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      chrome.runtime.sendMessage({
        method: 'open-in',
        href: a.href
      });
    }
  }
}

function update(bol) {
  document.removeEventListener('click', observe);
  if (bol) {
    document.addEventListener('click', observe);
  }
}

chrome.storage.local.get({
  link: false
}, prefs => update(prefs.link));
chrome.storage.onChanged.addListener(prefs => update(prefs.link.newValue));
