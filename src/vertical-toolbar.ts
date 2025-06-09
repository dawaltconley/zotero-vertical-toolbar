import verticalToolbarCss from './vertical-toolbar.css';

export interface VerticalToolbarOptions {
  id: string;
  version: string;
  rootURI: string;
  stylesId?: string;
}

export class VerticalToolbar {
  readonly id: string;
  readonly stylesId: string;
  readonly version: string;
  readonly rootURI: string;

  constructor({
    id = 'vertical-toolbar@dylan.ac',
    stylesId = 'verticalToolbarStyles',
    version,
    rootURI,
  }: VerticalToolbarOptions) {
    this.id = id;
    this.stylesId = stylesId;
    this.version = version;
    this.rootURI = rootURI;
  }

  async attachStylesToReader(reader: _ZoteroTypes.ReaderInstance) {
    await reader._waitForReader();
    await reader._initPromise;
    const doc = reader?._iframeWindow?.document;
    if (!doc || !doc.documentElement) {
      this.log(`couldn't attach styles; tab ${reader.tabID} not ready`);
      return;
    }
    if (doc.getElementById(this.stylesId)) {
      this.log(`skipping ${reader.tabID}: styles already attached`);
      return;
    }
    const styles = doc.createElement('style');
    styles.id = this.stylesId;
    styles.innerText = verticalToolbarCss;
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
