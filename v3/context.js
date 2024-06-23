/* global onCommand, translate */

{
  const once = () => {
    if (once.done) {
      return;
    }
    once.done = true;

    chrome.contextMenus.create({
      id: 'open-pdf',
      title: translate('bg_msg_8'),
      contexts: ['link'],
      documentUrlPatterns: ['*://*/*'],
      targetUrlPatterns: ['*://*/*.pdf*', '*://*/*.PDF*']
    }, () => chrome.runtime.lastError);
    chrome.contextMenus.create({
      id: 'tutorial',
      title: translate('bg_msg_6'),
      contexts: ['action']
    }, () => chrome.runtime.lastError);

    if (/Firefox/.test(navigator.userAgent)) {
      chrome.contextMenus.create({
        id: 'options',
        title: translate('bg_msg_7'),
        contexts: ['action']
      }, () => chrome.runtime.lastError);
    }
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
  else if (info.menuItemId === 'options') {
    chrome.runtime.openOptionsPage();
  }
  else {
    onCommand(info.srcUrl || info.linkUrl);
  }
});
