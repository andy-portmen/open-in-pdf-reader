'use strict';

const NATIVE = 'com.add0n.node';

const notify = (msg, color = '#000', timeout = 2000, id = 'status') => {
  document.getElementById('status').textContent = '';
  document.getElementById('toast').textContent = '';

  const status = document.getElementById(id);
  window.clearTimeout(notify.id);
  notify.id = window.setTimeout(() => status.textContent = '', timeout);
  status.textContent = msg;
  status.style.color = color;
  // status.scrollIntoView();
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
    notify('Double-click to reset!', 'red', 5000);
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
  url: chrome.runtime.getManifest().homepage_url + '?rd=donate'
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
                return notify('Does not exist; ' + error.code, 'red', 5000, 'toast');
              }
              else {
                return notify(error.code, 'red', 5000, 'toast');
              }
            }
            if (resp.isDirectory) {
              notify('Not a executable path! Is this a directory?', 'red', 5000, 'toast');
            }
            else {
              notify('Everything looks good!', 'green', 5000, 'toast');
            }
          });
        });
      }
      else {
        notify('Is native client installed?', 'red', 5000, 'toast');
      }
    });
  }
  else {
    notify('Enter the executable\'s path', 'red', 5000, 'toast');
    document.getElementById('path').focus();
  }
});

document.getElementById('insert').addEventListener('change', e => {
  document.getElementById('path').value = e.target.value;
});

// links
for (const a of [...document.querySelectorAll('[data-href]')]) {
  if (a.hasAttribute('href') === false) {
    a.href = chrome.runtime.getManifest().homepage_url + '#' + a.dataset.href;
  }
}
