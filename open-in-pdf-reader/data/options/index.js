/* globals config */
'use strict';

const notify = msg => {
  const status = document.getElementById('status');
  window.clearTimeout(notify.id);
  notify.id = window.setTimeout(() => status.textContent = '', 2000);
  status.textContent = msg;
};

// localization
[...document.querySelectorAll('[data-i18n]')].forEach(e => {
  e.textContent = chrome.i18n.getMessage(e.dataset.i18n);
});

document.getElementById('example-w').textContent = config.exmaple.windows;
document.getElementById('example-m').textContent = config.exmaple.mac;
document.querySelector('[data-i18n="options_open_faqs"]').href = chrome.runtime.getManifest().homepage_url;

function save() {
  chrome.storage.local.set({
    path: document.getElementById('path').value,
    link: document.getElementById('link').checked,
    notify: document.getElementById('notify').checked,
    faqs: document.getElementById('faqs').checked,
    download: document.getElementById('download').checked
  }, () => {
    notify('Options saved.');
  });
}

function restore() {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.local.get({
    path: config.path,
    link: config.link,
    notify: true,
    faqs: true,
    download: config.download
  }, prefs => {
    document.getElementById('path').value = prefs.path;
    document.getElementById('link').checked = prefs.link;
    document.getElementById('notify').checked = prefs.notify;
    document.getElementById('faqs').checked = prefs.faqs;
    document.getElementById('download').checked = prefs.download;
  });
}
document.addEventListener('DOMContentLoaded', restore);
document.getElementById('save').addEventListener('click', save);

document.getElementById('reset').addEventListener('click', e => {
  if (e.detail === 1) {
    notify('Double-click to reset!');
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


document.getElementById('check').addEventListener('click', () => {
  const path = document.getElementById('path').value;
  if (path) {
    chrome.runtime.sendNativeMessage('com.add0n.node', {
      permissions: ['fs'],
      args: [path],
      script: `
      require('fs').stat(args[0], (error, stats) => {
        if (error) {
          push({error});
          done();
        }
        push(Object.assign({}, stats, {
          isDirectory: stats.isDirectory()
        }));
        done();
      });
      `
    }, resp => {
      if (resp) {
        const error = resp.error;
        if (error) {
          console.log(error);
          if (error.code === 'ENOENT') {
            return notify('does not exist');
          }
          else {
            return notify(error.code);
          }
        }
        if (resp.isDirectory) {
          notify('Is this a directory?');
        }
        else {
          notify('Everything looks good!');
        }
      }
      else {
        chrome.tabs.create({
          url: '/data/helper/index.html'
        });
      }
    });
  }
  else {
    notify('PATH box is empty');
    document.getElementById('path').focus();
  }
});
