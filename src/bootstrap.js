var Toolbar;

function log(msg) {
  Zotero.debug("vertical-toolbar@dylan.ac:" + msg);
}

function install() {
  log("Installed Vertical Toolbar Plugin");
}

async function startup({ id, version, rootURI }) {
  log("Starting 2.0");

  Services.scriptloader.loadSubScript(rootURI + "vertical-toolbar.js");
  Toolbar = new VerticalToolbar({ id, version, rootURI });
  Toolbar.registerObserver();
  await Toolbar.styleExistingTabs();
}

function shutdown() {
  log("Shutting down 2.0");
  Toolbar.unregisterObserver();
  Toolbar = undefined;
}

function uninstall() {
  log("Uninstalled Vertical Toolbar Plugin");
}
