import { config } from '../package.json';
import { ToolbarPosition } from './utils';
import verticalToolbarCss from './vertical-toolbar.scss';

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

  #position: ToolbarPosition = 'right';
  get position(): ToolbarPosition {
    return this.#position;
  }
  set position(p: ToolbarPosition) {
    if (p !== this.#position) {
      this.#updatedTabs.clear();
    }
    this.#position = p;
  }

  #updatedTabs = new Set<string | number>();

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

  async startup(): Promise<void> {
    this.registerObserver();
    await this.addToAllWindows();
  }

  shutdown(): void {
    this.unregisterObserver();
    this.removeFromAllWindows();
  }

  async addToWindow(window: _ZoteroTypes.MainWindow): Promise<void> {
    this.addMenuItems(window);
    await this.styleCurrentTab(window);
  }

  async addToAllWindows(): Promise<void> {
    await Promise.all(Zotero.getMainWindows().map((w) => this.addToWindow(w)));
  }

  removeFromWindow(window: _ZoteroTypes.MainWindow): void {
    this.removeMenuItems(window);
  }

  removeFromAllWindows(): void {
    Zotero.getMainWindows().forEach((w) => this.removeFromWindow(w));
  }

  async attachStylesToReader(reader: _ZoteroTypes.ReaderInstance) {
    // wait until tab is ready
    await reader._waitForReader();
    await reader._initPromise;
    const doc = reader?._iframeWindow?.document;
    if (!doc || !doc.documentElement) {
      this.log(`couldn't attach styles; tab ${reader.tabID} not ready`);
      return;
    }

    // update position of toolbar in tab document
    (doc.documentElement as HTMLElement).dataset.toolbarPosition =
      this.position;

    // add stylesheet to tab if needed
    if (doc.getElementById(this.stylesId)) {
      this.log(`skipping ${reader.tabID}: styles already attached`);
    } else {
      const styles = doc.createElement('style');
      styles.id = this.stylesId;
      styles.innerText = verticalToolbarCss;
      doc.documentElement.appendChild(styles);
      this.log('appended styles to tab: ' + reader.tabID);
    }

    // mark tab as updated, skipping future updates until styles change
    this.#updatedTabs.add(reader.tabID);
  }

  async styleExistingTabs() {
    this.log('adding styles to existing tabs');
    const readers = Zotero.Reader._readers.filter(
      (r) => !this.#updatedTabs.has(r.tabID),
    );
    this.log(
      `found ${readers.length} reader tags: ${readers.map((r) => r.tabID).join(', ')}`,
    );
    await Promise.all(readers.map((r) => this.attachStylesToReader(r)));
    this.log('done adding styles to existing tabs');
  }

  async styleCurrentTab(window: _ZoteroTypes.MainWindow): Promise<void> {
    const current = Zotero.Reader.getByTabID(window.Zotero_Tabs.selectedID);
    if (current) {
      await this.attachStylesToReader(current);
    }
  }

  observerID?: string;
  registerObserver() {
    this.log('registering tab observer');
    if (this.observerID) {
      throw new Error(`${this.id}: observer is already registered`);
    }
    type Trigger = _ZoteroTypes.Notifier.Event | 'load'; // zotero-types doesn't include 'load' in the event definition, but tabs have a load event
    const triggers = new Set<Trigger>(['add', 'load', 'select']);
    this.observerID = Zotero.Notifier.registerObserver(
      {
        notify: async (event, type, ids, extraData) => {
          if (triggers.has(event) && type === 'tab') {
            const tabIDs = ids.filter(
              (id) =>
                extraData[id].type === 'reader' && !this.#updatedTabs.has(id),
            );
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

  addMenuItems(window: _ZoteroTypes.MainWindow): void {
    const doc = window.document;
    const menuId = `${config.addonRef}-radio-menu`;
    if (doc.getElementById(menuId)) {
      this.log('toolbar menu already attached');
      return;
    }

    window.MozXULElement.insertFTLIfNeeded(`${config.addonRef}-menu.ftl`);

    // submenu container
    const menu = doc.createXULElement('menu') as XULMenuElement;
    menu.id = menuId;
    menu.classList.add('menu-type-reader');
    menu.setAttribute('data-l10n-id', menuId);

    // submenu popup, contains menu items
    const popup = doc.createXULElement('menupopup') as XULMenuPopupElement;
    menu.appendChild(popup);

    // menu items: radio buttons
    const radios: XULMenuItemElement[] = [];
    for (const value of ToolbarPosition) {
      const radio = doc.createXULElement('menuitem') as XULMenuItemElement;
      radio.setAttribute('type', 'radio');
      radio.setAttribute('name', `${config.addonRef}-menu-ui-radio`);

      radio.id = `${config.addonRef}-radio-menu-${value}`;
      radio.value = value;
      radio.addEventListener('command', async () => {
        this.position = value;
        this.styleCurrentTab(window);
      });

      radio.setAttribute('data-l10n-id', radio.id);
      if (radio.value === this.position) {
        radio.setAttribute('checked', 'true');
      }

      radios.push(radio);
      popup.appendChild(radio);
    }

    const viewMenu = doc.getElementById('menu_viewPopup');
    const referenceNode =
      viewMenu?.querySelector('menuseparator.menu-type-library') || null;
    const inserted = viewMenu?.insertBefore(menu, referenceNode);

    if (inserted) {
      this.log(`successfully inserted menu: ${menu.id}`);
      this.storeAddedElement(menu);
    }
  }

  removeMenuItems(window: _ZoteroTypes.MainWindow): void {
    const doc = window.document;
    for (const id of this.#addedElementIDs) {
      doc.getElementById(id)?.remove();
    }
  }

  #addedElementIDs: string[] = [];
  storeAddedElement(elem: Element) {
    if (!elem.id) {
      throw new Error('Element must have an id');
    }
    this.#addedElementIDs.push(elem.id);
  }

  log(msg: string) {
    Zotero.debug(`${this.id}: ${msg}`);
  }
}
