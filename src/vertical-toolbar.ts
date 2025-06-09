export interface VerticalToolbarOptions {
  id: string;
  version: string;
  rootURI: string;
}

export class VerticalToolbar {
  id = 'vertical-toolbar@dylan.ac';
  version?: string;
  rootURI?: string;
  initialized = false;

  constructor({ id, version, rootURI }: VerticalToolbarOptions) {
    if (this.initialized) return;
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.initialized = true;
  }

  async attachStylesToReader(reader: _ZoteroTypes.ReaderInstance) {
    await reader._waitForReader();
    await reader._initPromise;
    const doc = reader?._iframeWindow?.document;
    if (!doc || !doc.documentElement) {
      this.log(`couldn't attach styles; tab ${reader.tabID} not ready`);
      return;
    }
    if (doc.getElementById(STYLES_ID)) {
      this.log(`skipping ${reader.tabID}: styles already attached`);
      return;
    }
    const styles = doc.createElement('style');
    styles.id = STYLES_ID;
    styles.innerText = STYLES_CSS;
    doc.documentElement.appendChild(styles);
    this.log('appended styles to tab: ' + reader.tabID);
  }

  async styleExistingTabs() {
    this.log('adding styles to existing tabs');
    const readers = Zotero.Reader._readers;
    this.log(
      `found ${readers.length} reader tags: ${readers.map((r) => r.tabID).join(', ')}`,
    );
    await Promise.all(readers.map((r) => this.attachStylesToReader(r)));
    this.log('done adding styles to existing tabs');
  }

  observerID?: string;
  registerObserver() {
    this.log('registering tab observer');
    if (this.observerID) {
      throw new Error(`${this.id}: observer is already registered`);
    }
    this.observerID = Zotero.Notifier.registerObserver(
      {
        notify: async (event, type, ids, extraData) => {
          // @ts-expect-error zotero-types doesn't include 'load' in the event definition, but tabs have a load event
          if ((event === 'add' || event === 'load') && type === 'tab') {
            const tabIDs = ids.filter((id) => extraData[id].type === 'reader');
            await Promise.all(
              tabIDs.map(async (id) => {
                const reader = Zotero.Reader.getByTabID(id.toString());
                await this.attachStylesToReader(reader);
              }),
            );
          }
        },
      },
      ['tab'],
    );
    this.log('registered observer: ' + this.observerID);
  }

  unregisterObserver() {
    if (this.observerID) {
      this.log('unregistering observer: ' + this.observerID);
      Zotero.Notifier.unregisterObserver(this.observerID);
      this.observerID = undefined;
    }
  }

  log(msg: string) {
    Zotero.debug(`${this.id}: ${msg}`);
  }
}

const STYLES_ID = 'verticalToolbarStyles';
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
