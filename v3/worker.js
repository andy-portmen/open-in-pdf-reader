const NATIVE = 'com.add0n.node';

self.importScripts('context.js');

const storage = prefs => new Promise(resolve => {
  chrome.storage.managed.get(prefs, ps => {
    chrome.storage.local.get(chrome.runtime.lastError ? prefs : Object.assign(prefs, ps), resolve);
  });
});

const translate = id => chrome.i18n.getMessage(id);

const notify = message => storage({
  notify: true
}).then(prefs => prefs.notify && chrome.notifications.create({
  title: chrome.runtime.getManifest().name,
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  message: message.message || message.error || message
}, notificationId => {
  chrome.alarms.create('close/notification:' + notificationId, {
    when: Date.now() + 3000
  });
}));

const uconfirm = (message, href) => chrome.notifications.create('open:' + href, {
  title: chrome.runtime.getManifest().name,
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  message
}, notificationId => {
  chrome.alarms.create('close/notification:' + notificationId, {
    when: Date.now() + 10000
  });
});

chrome.notifications.onClicked.addListener(id => {
  if (id.startsWith('open:')) {
    onCommand(id.replace('open:', ''));
    chrome.notifications.clear(id);
  }
});

const observe = () => {
  if (observe.skip) {
    return;
  }
  observe.skip = true;
  chrome.downloads.onChanged.addListener(d => {
    if (d.state && (d.state.current === 'complete' || d.state.current === 'interrupted')) {
      chrome.storage.session.get({
        ids: []
      }, ps => {
        storage({
          delay: 0
        }).then(prefs => {
          if (ps.ids.includes(d.id)) {
            if (d.state.current === 'complete') {
              chrome.alarms.create('open:' + d.id, {
                when: Date.now() + prefs.delay * 1000
              });
            }
            else {
              notify(translate('bg_msg_2'));
            }
          }
        });
      });
    }
  });
};
observe.skip = false;

chrome.alarms.onAlarm.addListener(a => {
  if (a.name.startsWith('open:')) {
    chrome.downloads.search({
      id: Number(a.name.replace('open:', ''))
    }, ([d]) => {
      if (d) {
        storage({
          delay: 0
        }).then(prefs => setTimeout(open, prefs.delay * 1000, d));
      }
      else {
        notify(translate('bg_msg_1'));
      }
    });
  }
  else if (a.name.startsWith('close/notification:')) {
    chrome.notifications.clear(a.name.replace('close/notification:', ''));
  }
});

// do we need to observe download changes
chrome.storage.session.get({
  ids: []
}, async prefs => {
  const ids = [];
  for (const id of prefs.ids) {
    const ds = await new Promise(resolve => chrome.downloads.search({id}, resolve));
    if (ds.length === 0 || ds[0].state === 'complete' || ds[0].state === 'interrupted') {
      ids.push(id);
    }
  }
  prefs.ids = prefs.ids.filter(id => ids.indexOf(id) === -1);
  chrome.storage.session.set(prefs);
  if (prefs.ids.length) {
    observe();
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

  chrome.storage.session.get({
    ids: []
  }, prefs => chrome.downloads.download({url}, id => chrome.storage.session.set({
    ids: [...prefs.ids, id]
  }, observe)));
}

function open(d) {
  const n = Date.now();
  storage({
    path: ''
  }).then(prefs => {
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
  storage({
    download: true,
    path: ''
  }).then(prefs => {
    // if path is not set, we need to first download the PDF file so that
    // the OS detects the external executable from the mime type
    if (prefs.download || prefs.path === '') {
      download(url);
    }
    else {
      open({
        filename: url
      });
    }
  });
};

chrome.action.onClicked.addListener(tab => {
  if (tab.url) {
    if (tab.url.includes('PDF') || tab.url.includes('pdf')) {
      return onCommand(tab.url);
    }
    else {
      uconfirm(translate('bg_msg_4'), tab.url);
    }
  }
  else {
    notify(translate('bg_msg_5'));
  }
});
chrome.runtime.onMessage.addListener(request => {
  if (request.method === 'open-in') {
    onCommand(request.href);
    notify(translate('bg_msg_3'));
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
            tabs.query({active: true, lastFocusedWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
