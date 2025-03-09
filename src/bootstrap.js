var Toolbar;
var Zoom;

function log(msg) {
  Zotero.debug("vertical-toolbar@dylan.ac: " + msg);
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

  Services.scriptloader.loadSubScript(rootURI + "center-zoom.js");
  Zoom = new CenterZoom({ id, version, rootURI });
  Zoom.startup();
}

function shutdown() {
  log("Shutting down 2.0");
  Toolbar.unregisterObserver();
  Toolbar = undefined;

  Zoom.shutdown();
  Zoom = undefined;
}

function uninstall() {
  log("Uninstalled Vertical Toolbar Plugin");
}
