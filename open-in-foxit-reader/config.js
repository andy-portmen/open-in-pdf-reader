'use strict';

var config = {
  download: true,
  path: {
    Mac: 'open -a "Foxit Reader"',
    Win: '"%ProgramFiles(x86)%\\Foxit Software\\Foxit Reader\\FoxitReader.exe"',
    Lin: '"Foxit Reader"'
  }[navigator.platform.substr(0, 3)] || '',
  link: false,
  exmaple: {
    windows: 'C:\\Program Files (x86)\\Foxit Software\\Foxit Reader\\FoxitReader.exe',
    mac: 'open -a "Foxit Reader"'
  }
};
