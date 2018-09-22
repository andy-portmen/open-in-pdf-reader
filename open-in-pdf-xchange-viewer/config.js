'use strict';

var config = {
  download: false,
  path: {
    Mac: '',
    Win: '"%ProgramFiles%\\Tracker Software\\PDF Viewer\\PDFXCview.exe"',
    Lin: ''
  }[navigator.platform.substr(0, 3)] || '',
  link: false,
  exmaple: {
    windows: 'C:\\Program Files\\Tracker Software\\PDF Viewer\\PDFXCview.exe',
    mac: 'open -a "PDF-XChange Viewer"'
  }
};
