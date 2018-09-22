/* globals config */
'use strict';

var notify = message => chrome.storage.local.get({
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
                  reject('Cannot find the downloaded PDF file!');
                }
              });
            }
            else {
              reject('Download was interrupted');
            }
          }
        }
      }
      chrome.downloads.onChanged.addListener(observe);
    });
  });
}

function open(d) {
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
          notify(msg);
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

var onCommand = url => {
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
  onCommand(tab.url);
});
chrome.runtime.onMessage.addListener(request => {
  if (request.method === 'open-in') {
    onCommand(request.href);
    notify('Please wait...');
  }
});

// icon
var button = {
  mode: ({id, url}) => {
    const enabled = url.indexOf('.pdf') !== -1 || url.indexOf('.PDF') !== -1;
    chrome.browserAction[enabled ? 'enable' : 'disable'](id);
  }
};
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => changeInfo.url && button.mode(tab));

// One time
(callback => {
  chrome.runtime.onInstalled.addListener(callback);
  chrome.runtime.onStartup.addListener(callback);
})(() => {
  // add the context-menu
  chrome.contextMenus.create({
    id: 'open-in',
    title: chrome.runtime.getManifest().name,
    contexts: ['link'],
    targetUrlPatterns: ['*://*/*pdf*'],
    documentUrlPatterns: ['*://*/*']
  });
  // update disable/enable mode
  chrome.tabs.query({}, tabs => tabs.forEach(button.mode));
  // FAQs & Feedback
  chrome.storage.local.get({
    'version': null,
    'faqs': true,
    'last-update': 0
  }, prefs => {
    const version = chrome.runtime.getManifest().version;

    if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
      const now = Date.now();
      const doUpdate = (now - prefs['last-update']) / 1000 / 60 / 60 / 24 > 30;
      chrome.storage.local.set({
        version,
        'last-update': doUpdate ? Date.now() : prefs['last-update']
      }, () => {
        // do not display the FAQs page if last-update occurred less than 30 days ago.
        if (doUpdate) {
          const p = Boolean(prefs.version);
          window.setTimeout(() => chrome.tabs.create({
            url: chrome.runtime.getManifest().homepage_url + '&version=' + version +
              '&type=' + (p ? ('upgrade&p=' + prefs.version) : 'install'),
            active: p === false
          }), 3000);
        }
      });
    }
  });

  {
    const {name, version} = chrome.runtime.getManifest();
    chrome.runtime.setUninstallURL(
      chrome.runtime.getManifest().homepage_url + '&rd=feedback&name=' + name + '&version=' + version
    );
  }
});
