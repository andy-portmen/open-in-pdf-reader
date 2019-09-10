'use strict';

var config = {
  download: true,
  path: {
    Mac: '',
    Win: '"%ProgramFiles(x86)%\\SumatraPDF\\SumatraPDF.exe"',
    Lin: ''
  }[navigator.platform.substr(0, 3)] || '',
  link: false,
  exmaple: {
    windows: 'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe',
    mac: 'open -a "SumatraPDF"'
  }
};


