import verticalToolbarCss from './vertical-toolbar.scss';
import { config } from '../package.json';

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
    Zotero.getMainWindows().forEach((w) => this.addMenuItems(w));
    this.registerObserver();
    await this.styleExistingTabs();
  }

  shutdown(): void {
    Zotero.getMainWindows().forEach((w) => this.removeMenuItems(w));
    this.unregisterObserver();
  }

  async attachStylesToReader(reader: _ZoteroTypes.ReaderInstance) {
    await reader._waitForReader();
    await reader._initPromise;
    const doc = reader?._iframeWindow?.document;
    if (!doc || !doc.documentElement) {
      this.log(`couldn't attach styles; tab ${reader.tabID} not ready`);
      return;
    }
    (doc.documentElement as HTMLElement).dataset.toolbarPosition =
      this.position;
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
    for (let i = 0; i < 3; i++) {
      const radio = doc.createXULElement('menuitem') as XULMenuItemElement;
      radio.setAttribute('type', 'radio');
      radio.setAttribute('name', `${config.addonRef}-menu-ui-radio`);

      if (i === 0) {
        radio.id = `${config.addonRef}-radio-menu-top`;
        radio.value = 'top';
      } else if (i === 1) {
        radio.id = `${config.addonRef}-radio-menu-left`;
        radio.value = 'left';
      } else if (i === 2) {
        radio.id = `${config.addonRef}-radio-menu-right`;
        radio.value = 'right';
      }

      radio.setAttribute('data-l10n-id', radio.id);
      if (radio.value === this.position) {
        radio.setAttribute('checked', 'true');
      }

      radios.push(radio);
      popup.appendChild(radio);
    }

    popup.addEventListener('command', async ({ target }: CommandEvent) => {
      if (target && 'value' in target && isToolbarPosition(target.value)) {
        this.#position = target.value;
        await this.styleExistingTabs();
      }
    });

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

const ToolbarPosition = ['top', 'left', 'right'] as const;
type ToolbarPosition = (typeof ToolbarPosition)[number];
const isToolbarPosition = (value: any): value is ToolbarPosition =>
  ToolbarPosition.some((p) => p === value?.toString());
