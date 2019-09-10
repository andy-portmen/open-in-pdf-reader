/* globals config */
'use strict';

const notify = message => chrome.storage.local.get({
  notify: true
}, prefs => prefs.notify && chrome.notifications.create({
  title: chrome.runtime.getManifest().name,
  type: 'basic',
  iconUrl: 'data/icons/48.png',
  message
}));

function download(url) {
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
      function observe(d) {
        if (d.id === id && d.state) {
          if (d.state.current === 'complete' || d.state.current === 'interrupted') {
            chrome.downloads.onChanged.removeListener(observe);
            if (d.state.current === 'complete') {
              chrome.downloads.search({id}, ([d]) => {
                if (d) {
                  resolve(d);
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
      }
      chrome.downloads.onChanged.addListener(observe);
    });
  });
}

function open(d) {
  const n = Date.now();
  chrome.storage.local.get({
    path: config.path
  }, prefs => {
    chrome.runtime.sendNativeMessage('com.add0n.node', {
      permissions: ['child_process', 'os'],
      args: [d.filename, prefs.path],
      script: `
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
          push({error, stdout, stderr});
          done();
        });
      `
    }, resp => {
      if (resp) {
        const msg = resp.stderr || resp.error || resp.stdout;
        if (msg) {
          console.error(resp);
          // only display errors in 2s window
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
    download: config.download,
    path: config.path
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

chrome.contextMenus.onClicked.addListener(info => {
  onCommand(info.srcUrl || info.linkUrl);
});
chrome.browserAction.onClicked.addListener(tab => {
  chrome.permissions.request({
    permissions: ['activeTab']
  }, granted => {
    if (granted && tab.url) {
      onCommand(tab.url);
    }
  });
});
chrome.runtime.onMessage.addListener(request => {
  if (request.method === 'open-in') {
    onCommand(request.href);
    notify(chrome.i18n.getMessage('bg_msg_3'));
  }
});

// icon
const button = {
  mode: ({id, url}) => {
    const enabled = url && (url.indexOf('.pdf') !== -1 || url.indexOf('.PDF') !== -1);
    chrome.browserAction[enabled ? 'enable' : 'disable'](id);
  }
};
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => changeInfo.url && button.mode(tab));

// One time
{
  // add the context-menu
  const onStartup = () => {
    chrome.contextMenus.create({
      id: 'open-in',
      title: chrome.runtime.getManifest().name,
      contexts: ['link'],
      targetUrlPatterns: ['*://*/*pdf*'],
      documentUrlPatterns: ['*://*/*']
    });
    // update disable/enable mode
    chrome.tabs.query({}, tabs => tabs.forEach(button.mode));
  };
  chrome.runtime.onInstalled.addListener(onStartup);
  chrome.runtime.onStartup.addListener(onStartup);
}

// FAQs and Feedback
{
  const {onInstalled, setUninstallURL, getManifest} = chrome.runtime;
  const {name, version} = getManifest();
  const page = getManifest().homepage_url;
  onInstalled.addListener(({reason, previousVersion}) => {
    chrome.storage.local.get({
      'faqs': true,
      'last-update': 0
    }, prefs => {
      if (reason === 'install' || (prefs.faqs && reason === 'update')) {
        const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
        if (doUpdate && previousVersion !== version) {
          chrome.tabs.create({
            url: page + '&version=' + version +
              (previousVersion ? '&p=' + previousVersion : '') +
              '&type=' + reason,
            active: reason === 'install'
          });
          chrome.storage.local.set({'last-update': Date.now()});
        }
      }
    });
  });
  setUninstallURL(page + '&rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
}
