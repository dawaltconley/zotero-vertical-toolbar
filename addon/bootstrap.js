/* eslint-disable no-undef */

var toolbar;

function log(msg) {
  Zotero.debug('__addonID__' + msg);
}

function install() {
  log('Installed plugin');
}

async function startup({ id, version, rootURI }) {
  log('Starting plugin');

  Services.scriptloader.loadSubScript(
    `${rootURI}/content/scripts/__addonRef__.js`,
  );
  toolbar = new __addonInstance__.VerticalToolbar({ id, version, rootURI });
  await toolbar.startup();
}

async function onMainWindowLoad({ window }) {
  toolbar.registerObserver();
  await toolbar.addToWindow(window);
}

function onMainWindowUnload({ window }) {
  toolbar.unregisterObserver();
  toolbar.removeFromWindow(window);
}

function shutdown() {
  log('Shutting down plugin');
  toolbar.shutdown();
  toolbar = undefined;
}

function uninstall() {
  log('Uninstalled plugin');
}
