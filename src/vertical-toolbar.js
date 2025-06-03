class VerticalToolbar {
  id = "vertical-toolbar@dylan.ac";
  version = null;
  rootURI = null;
  initialized = false;

  constructor({ id, version, rootURI }) {
    if (this.initialized) return;
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.initialized = true;
  }

  async attachStylesToReader(reader) {
    await reader._waitForReader()
    await reader._initPromise
    const doc = reader?._iframeWindow?.document;
    if (!doc) {
      this.log(`couldn't attach styles; tab ${reader.tabID} not ready`);
      return;
    }
    if (doc.getElementById(STYLES_ID)) {
      this.log(`skipping ${reader.tabID}: styles already attached`);
      return;
    }
    const styles = doc.createElement("style");
    styles.id = STYLES_ID;
    styles.innerText = STYLES_CSS;
    doc.documentElement.appendChild(styles);
    this.log('appended styles to tab: ' + reader.tabID);
  }

  async removeStylesFromReader(reader) {
    await reader._waitForReader()
    await reader._initPromise
    const doc = reader?._iframeWindow?.document;
    if (!doc) {
      this.log(`couldn't remove styles; tab ${reader.tabID} not ready`);
      return;
    }
    doc.getElementById(STYLES_ID)?.remove();
  }

  async styleExistingTabs() {
    this.log('adding styles to existing tabs')
    const readers = Zotero.Reader._readers;
    this.log(`found ${readers.length} reader tags: ${readers.map(r => r.tabID).join(', ')}`)
    await Promise.all(readers.map(reader => this.attachStylesToReader(reader)));
    this.log('done adding styles to existing tabs')
  }

  observerID = null;
  registerObserver() {
    this.log("registering tab observer");
    if (this.observerID) {
      throw new Error(`${this.id}: observer is already registered`);
    }
    this.observerID = Zotero.Notifier.registerObserver(
      {
        notify: async (event, type, ids, extraData) => {
          if ((event === "add" || event === "load") && type === "tab") {
            const tabIDs = ids.filter((id) => extraData[id].type === "reader");
            await Promise.all(tabIDs.map(async (id) => {
              const reader = Zotero.Reader.getByTabID(id);
              await this.attachStylesToReader(reader);
              this.addMenuOptions(reader);
            }))
          }
        },
      },
      ["tab"],
    );
    this.log("registered observer: " + this.observerID);
  }

  unregisterObserver() {
    if (this.observerID) {
      this.log("unregistering observer: " + this.observerID);
      Zotero.Notifier.unregisterObserver(this.observerID);
      this.observerID = null;
    }
  }

  #addedElements = []

  addMenuOptions(reader) {
    const doc = reader?._iframeWindow?.document;
    if (!doc) {
      this.log(`couldn't add menu options; tab ${reader.tabID} not ready`);
      return;
    }
    const toggle = doc.createXULElement('menuitem');
    toggle.id = 'vertical-toolbar-toggle';
    toggle.setAttribute('label', 'Vertical Toolbar');
		toggle.setAttribute('type', 'checkbox');
    toggle.addEventListener('command', () => {
      if (toggle.checked) {
        this.attachStylesToReader(reader);
      } else {
        this.removeStylesFromReader(reader);
      }
    });
    doc.getElementById('menu_viewPopup').appendChild(toggle);
    this.#addedElements.push(toggle.id)
  }

  removeMenuOptions(reader) {
    const doc = reader?._iframeWindow?.document;
    if (!doc) {
      this.log(`couldn't remove menu options; tab ${reader.tabID} not ready`);
      return;
    }
    for (const id of this.#addedElements) {
      doc.getElementById(id)?.remove();
    }
  }

  // async startup() {
  //   this.registerObserver();
  //   await this.styleExistingTabs();
  // }
  //
  // shutdown() {
  //   this.unregisterObserver();
  // }

  log(msg) {
    Zotero.debug(`${this.id}: ${msg}`);
  }
}

const STYLES_ID = "verticalToolbarStyles";
const STYLES_CSS = `
.toolbar, .toolbar .start, .toolbar .center, .toolbar .end {
  flex-direction: column;
}

.toolbar {
  min-height: auto;
  min-width: 42px;
  height: 100% !important;
  height: calc(100% - var(--bottom-placeholder-height)) !important;
  position: absolute;
  top: 0;
  right: 0;
  left: auto;
  padding: 8px 0px;
  border-bottom: none;
  border-left: var(--material-panedivider);
}

.toolbar .divider {
  width: 20px;
  height: 1px;
}

.toolbar #pageNumber, .toolbar #numPages {
  width: 38px;
}

.toolbar #numPages {
  display: block;
  text-align: center;
}

.toolbar #numPages > div {
  display: inline;
  position: static;
}

#split-view, .split-view {
  top: 0;
  right: 42px;
}`.trim();
