/* eslint-disable no-undef */

var Toolbar;

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
  Toolbar = new __addonInstance__.VerticalToolbar({ id, version, rootURI });
  Toolbar.registerObserver();
  await Toolbar.styleExistingTabs();
}

function shutdown() {
  log('Shutting down plugin');
  Toolbar.unregisterObserver();
  Toolbar = undefined;
}

function uninstall() {
  log('Uninstalled plugin');
}
