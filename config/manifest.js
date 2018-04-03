/* eslint-env node */
'use strict';

module.exports = function(/* environment, appConfig */) {
  // See https://github.com/san650/ember-web-app#documentation for a list of
  // supported properties

  return {
    name: "Crash Course",
    short_name: "Crash Course",
    description: "An experimental Phaser.js game.",
    start_url: "/",
    display: "standalone",
    background_color: "#F0F1F1",
    theme_color: "#25B7D3",
    icons: [
      {
        src: "/assets/brick.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/assets/brick.png",
        sizes: "512x512",
        type: "image/png"
      },
      {
        src: "/assets/brick.png",
        sizes: "180x180",
        type: "image/png",
        targets: ['apple']
      },
      {
        src: "/assets/brick.png",
        element: "square150x150logo",
        targets: ['ms']
      }
    ],
    ms: {
      tileColor: '#F0F1F1'
    }
  };
}
