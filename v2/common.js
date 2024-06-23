'use strict';

const NATIVE = 'com.add0n.node';

const notify = message => chrome.storage.local.get({
  notify: true
}, prefs => prefs.notify && chrome.notifications.create({
  title: chrome.runtime.getManifest().name,
  type: 'basic',
  iconUrl: 'data/icons/48.png',
  message: message.message || message.error || message
}));

const confirm = message => new Promise((resolve, reject) => {
  chrome.notifications.create({
    title: chrome.runtime.getManifest().name,
    type: 'basic',
    iconUrl: 'data/icons/48.png',
    message
  }, id => {
    setTimeout(() => {
      reject(Error('timeout'));
      chrome.notifications.clear(id);
      delete confirm.ids[id];
    }, 30000);
    confirm.ids[id] = {
      resolve
    };
  });
});
confirm.ids = {};
chrome.notifications.onClicked.addListener(id => {
  if (confirm.ids[id]) {
    chrome.notifications.clear(id);
    confirm.ids[id].resolve();
    delete confirm.ids[id];
  }
});

function download(url) {
  /* Google Redirect */
  if (/google\.[^./]+\/url?/.test(url)) {
    const tmp = /url=([^&]+)/.exec(url);
    if (tmp && tmp.length) {
      url = decodeURIComponent(tmp[1]);
    }
  }
  // https://github.com/andy-portmen/native-client/issues/70
  url = url.split('#')[0];

  return new Promise((resolve, reject) => {
    chrome.downloads.download({url}, id => {
      const observe = d => {
        if (d.id === id && d.state) {
          if (d.state.current === 'complete' || d.state.current === 'interrupted') {
            chrome.downloads.onChanged.removeListener(observe);
            if (d.state.current === 'complete') {
              chrome.downloads.search({id}, ([d]) => {
                if (d) {
                  chrome.storage.local.get({
                    delay: 0
                  }, prefs => setTimeout(resolve, prefs.delay * 1000, d));
                }
                else {
                  reject(chrome.i18n.getMessage('bg_msg_1'));
                }
              });
            }
            else {
              reject(chrome.i18n.getMessage('bg_msg_1'));
            }
          }
        }
      };
      chrome.downloads.onChanged.addListener(observe);
    });
  });
}

function open(d) {
  const n = Date.now();
  chrome.storage.local.get({
    path: ''
  }, prefs => {
    const script = `
      const os = require('os').platform();
      let cmd = 'start "' + args[0] +'"';
      if (os === 'darwin') {
        cmd = 'open "' + args[0] + '"';
      }
      if (os.startsWith('win')) {
        cmd = 'start "" "' + args[0] +'"';
      }
      if (args[1]) {
        cmd = args[1] + ' "' + args[0] + '"';
      }
      require('child_process').exec(cmd, (error, stdout, stderr) => {
        if (cmd.indexOf('%ProgramFiles(x86)%') !== -1 && error) {
          cmd = cmd.replace('%ProgramFiles(x86)%', '%ProgramFiles%')
          require('child_process').exec(cmd, (error, stdout, stderr) => {
            push({error, stdout, stderr});
            done();
          });
        }
        else {
          push({error, stdout, stderr});
          done();
        }
      });
    `;
    chrome.runtime.sendNativeMessage(NATIVE, {
      permissions: ['child_process', 'os'],
      args: [d.filename, prefs.path],
      script
    }, resp => {
      if (resp) {
        const msg = resp.stderr || resp.error || resp.stdout;
        if (msg) {
          console.error(resp);
          // only display errors during 2s window
          if (Date.now() - n < 2000) {
            notify(msg.error || msg);
          }
        }
      }
      else {
        chrome.tabs.create({
          url: '/data/helper/index.html'
        });
      }
    });
  });
}

const onCommand = url => {
  chrome.storage.local.get({
    download: true,
    path: ''
  }, prefs => {
    // if path is not set, we need to fist download the PDF file so that
    // the OS detects the external executable from file's mime type
    if (prefs.download || prefs.path === '') {
      download(url).then(open, notify);
    }
    else {
      open({
        filename: url
      });
    }
  });
};

{
  const once = () => {
    chrome.contextMenus.create({
      id: 'open-pdf',
      title: 'Open in PDF Reader',
      contexts: ['link'],
      documentUrlPatterns: ['*://*/*'],
      targetUrlPatterns: ['*://*/*.pdf*', '*://*/*.PDF*']
    });
    chrome.contextMenus.create({
      id: 'tutorial',
      title: 'Usage Instruction',
      contexts: ['browser_action']
    });
  };
  chrome.runtime.onStartup.addListener(once);
  chrome.runtime.onInstalled.addListener(once);
}
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'tutorial') {
    chrome.tabs.create({
      index: tab.index + 1,
      url: 'https://www.youtube.com/watch?v=HVyk0EWA5F8'
    });
  }
  else {
    onCommand(info.srcUrl || info.linkUrl);
  }
});
chrome.browserAction.onClicked.addListener(tab => {
  if (tab.url) {
    if (tab.url.indexOf('PDF') !== -1 || tab.url.indexOf('pdf') !== -1) {
      return onCommand(tab.url);
    }
    else {
      confirm(chrome.i18n.getMessage('bg_msg_4')).then(() => {
        onCommand(tab.url);
      }).catch(() => {});
    }
  }
  else {
    notify(chrome.i18n.getMessage('bg_msg_5'));
  }
});
chrome.runtime.onMessage.addListener(request => {
  if (request.method === 'open-in') {
    onCommand(request.href);
    notify(chrome.i18n.getMessage('bg_msg_3'));
  }
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '&version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '&rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
