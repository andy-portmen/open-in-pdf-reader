'use strict';

const NATIVE = 'com.add0n.node';

const notify = msg => {
  const status = document.getElementById('status');
  window.clearTimeout(notify.id);
  notify.id = window.setTimeout(() => status.textContent = '', 2000);
  status.textContent = msg;
  status.scrollIntoView();
};

// localization
[...document.querySelectorAll('[data-i18n]')].forEach(e => {
  e.textContent = chrome.i18n.getMessage(e.dataset.i18n);
});

document.querySelector('[data-i18n="options_open_faqs"]').href = chrome.runtime.getManifest().homepage_url;

function save() {
  chrome.storage.local.set({
    path: document.getElementById('path').value,
    link: document.getElementById('link').checked,
    notify: document.getElementById('notify').checked,
    faqs: document.getElementById('faqs').checked,
    download: document.getElementById('download').checked,
    delay: Math.max(0, Number(document.getElementById('delay').value))
  }, () => {
    notify('Options saved.');
  });
}

function restore() {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.local.get({
    path: '',
    link: false,
    notify: true,
    faqs: true,
    download: true,
    delay: 0
  }, prefs => {
    document.getElementById('path').value = prefs.path;
    document.getElementById('link').checked = prefs.link;
    document.getElementById('notify').checked = prefs.notify;
    document.getElementById('faqs').checked = prefs.faqs;
    document.getElementById('download').checked = prefs.download;
    document.getElementById('delay').value = prefs.delay;
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
  let path = document.getElementById('path').value;
  if (path) {
    chrome.runtime.sendNativeMessage(NATIVE, {
      cmd: 'spec'
    }, r => {
      if (r && r.env) {
        for (const [key, value] of Object.entries(r.env)) {
          path = path.replace(`%${key}%`, value);
        }
        path = path.replace(/^['"]/, '').replace(/['"]$/, '');

        chrome.runtime.sendNativeMessage(NATIVE, {
          cmd: 'env'
        }, res => {
          if (res && res.env && res.env.ProgramFiles) {
            path = path
              .replace('%LOCALAPPDATA%', res.env.LOCALAPPDATA)
              .replace('%ProgramFiles(x86)%', res.env['ProgramFiles(x86)'])
              .replace('%ProgramFiles%', res.env.ProgramFiles);
          }
          chrome.runtime.sendNativeMessage(NATIVE, {
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
            console.log(resp);
            const error = resp.error;
            if (error) {
              console.log(error);
              if (error.code === 'ENOENT') {
                return notify('Does not exist; ' + error.code);
              }
              else {
                return notify(error.code);
              }
            }
            if (resp.isDirectory) {
              notify('Not a executable path! Is this a directory?');
            }
            else {
              notify('Everything looks good!');
            }
          });
        });
      }
      else {
        notify('Is native client installed?');
      }
    });
  }
  else {
    notify('PATH box is empty');
    document.getElementById('path').focus();
  }
});

document.getElementById('insert').addEventListener('change', e => {
  document.getElementById('path').value = e.target.value;
});
