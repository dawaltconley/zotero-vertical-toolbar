class CenterZoom {
  id = "center-zoom@dylan.ac";
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

  async addListeners(reader) {
    this.log('adding page listeners');
    await reader._waitForReader();
    await reader._initPromise;
    const doc = reader?._iframeWindow?.document;
    const iframe = doc?.querySelector('iframe[src="pdf/web/viewer.html"]')
    if (!doc || !iframe) {
      this.log(`couldn't attach styles; tab ${reader.tabID} not ready`);
      return;
    }
    this.log(doc.documentElement.outerHTML);
    const previous = doc.querySelector('button#previous');
    const next = doc.querySelector('button#next');
    const viewer = await new Promise((resolve) => {
      const viewer = iframe.contentDocument?.querySelector('#viewerContainer');
      if (viewer) {
        resolve(viewer)
      } else {
        iframe.addEventListener('load', () => {
          const viewer = iframe.contentDocument?.querySelector('#viewerContainer');
          resolve(viewer)
        })
      }
    })
    this.log(viewer.outerHTML);
    // const pages = viewer.querySelectorAll('.pdfViewer .page');
    // if (pages.length === 0) {
    //   this.log(`no pages found in ${reader.tabID}, may not be a PDF`);
    //   return;
    // }

    previous.addEventListener('click', (event) => {
      const pages = viewer.querySelectorAll('.pdfViewer .page');
      if (!pages.length) return
      const c = CenterZoom.getCurrentPageIndex();
      const current = pages[c]
      const previous = pages[c - 1]
      if (!previous) return;
      const target = getScrollTarget(viewer, previous);
      this.log(`scrolling to ${target}`)
      viewer.scroll(0, target);
    })

    next.addEventListener('click', (event) => {
      const pages = viewer.querySelectorAll('.pdfViewer .page');
      if (!pages.length) return
      const c = CenterZoom.getCurrentPageIndex();
      const current = pages[c]
      const next = pages[c + 1]
      if (!next) return;
      const target = getScrollTarget(viewer, next);
      this.log(`scrolling to ${target}`)
      viewer.scroll(0, target);
    })

    this.log('added page listeners')
  }

  observerID = null;
  registerObserver() {
    this.log("registering tab observer");
    if (this.observerID) {
      throw new Error(`${this.id}: observer is already registered`);
    }
    Zotero.Reader.registerEventListener('renderToolbar', async function handler(event) {
      console.log('rendered toolbar')
      console.log('doc' + event?.doc?.outerHTML)
      await this.addListeners(event.reader);
      // Zotero.Reader.unregisterEventListener('renderToolbar', handler);
    }, this.id);
    // this.observerID = Zotero.Notifier.registerObserver(
    //   {
    //     notify: async (event, type, ids, extraData) => {
    //       if ((event === "add" || event === "load") && type === "tab") {
    //         const tabIDs = ids.filter((id) => extraData[id].type === "reader");
    //         this.log(JSON.stringify([event, type, ids, extraData]))
    //         await Promise.all(tabIDs.map(async (id) => {
    //           const reader = Zotero.Reader.getByTabID(id);
    //           Zotero.Reader.registerEventListener('renderToolbar', async function handler(event) {
    //             await this.addListeners(reader);
    //             Zotero.Reader.unregisterEventListener('renderToolbar', handler);
    //           }, this.id);
    //         }))
    //       }
    //     },
    //   },
    //   ["tab"],
    // );
    this.log("registered observer: " + this.observerID);
  }

  unregisterObserver() {
    if (this.observerID) {
      this.log("unregistering observer: " + this.observerID);
      Zotero.Notifier.unregisterObserver(this.observerID);
      this.observerID = null;
    }
  }

  log(msg) {
    Zotero.debug(`${this.id}: ${msg}`);
  }

  static getScrollTarget(viewer, page) {
    var offset = (page.clientHeight - viewer.clientHeight) * 0.5;
    return page.offsetHeight + offset;
  }

  static getCurrentPageIndex() {
    return Zotero.Reader._readers[0]._internalReader._state.primaryViewState
  }
}
