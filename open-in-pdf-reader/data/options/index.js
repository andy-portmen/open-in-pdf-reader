/* globals config */
'use strict';

// localization
[...document.querySelectorAll('[data-i18n]')].forEach(e => {
  e.textContent = chrome.i18n.getMessage(e.dataset.i18n);
});

document.getElementById('example-w').textContent = config.exmaple.windows;
document.getElementById('example-m').textContent = config.exmaple.mac;

function save() {
  chrome.storage.local.set({
    path: document.getElementById('path').value,
    link: document.getElementById('link').checked,
    notify: document.getElementById('notify').checked,
    download: document.getElementById('download').checked
  }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(() => status.textContent = '', 750);
  });
}

function restore() {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.local.get({
    path: config.path,
    link: config.link,
    notify: true,
    download: config.download
  }, prefs => {
    document.getElementById('path').value = prefs.path;
    document.getElementById('link').checked = prefs.link;
    document.getElementById('notify').checked = prefs.notify;
    document.getElementById('download').checked = prefs.download;
  });
}
document.addEventListener('DOMContentLoaded', restore);
document.getElementById('save').addEventListener('click', save);

document.getElementById('reset').addEventListener('click', e => {
  if (e.detail === 1) {
    const status = document.getElementById('status');
    window.setTimeout(() => status.textContent = '', 750);
    status.textContent = 'Double-click to reset!';
  }
  else {
    localStorage.clear();
    chrome.storage.local.clear(() => {
      chrome.runtime.reload();
      window.close();
    });
  }
});

document.getElementById('support').addEventListener('click', () => chrome.tabs.create({
  url: chrome.runtime.getManifest().homepage_url + '&rd=donate'
}));
console.log(9);
