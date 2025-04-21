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

  centerCurrentPage(viewer) {
    const page = CenterZoom.getCurrentPage(viewer);
    if (!page) {
      this.log("couldn't identify current page")
      return
    }
    const target = CenterZoom.getScrollTarget(viewer, page)
    this.log(`scrolling to ${JSON.stringify(target)}`)
    viewer.scrollTo(target);
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

    const previous = doc.querySelector('button#previous');
    const next = doc.querySelector('button#next');
    const back = doc.querySelector('button#navigateBack');
    const pageInput = doc.querySelector('input#pageNumber');

    const viewer = await CenterZoom.getViewerContainer(iframe)

    const handler = () => setTimeout(() => {
      this.centerCurrentPage(viewer);
    }, 0)
    previous.addEventListener('click', handler)
    next.addEventListener('click', handler)
    back.addEventListener('click', handler)
    pageInput.addEventListener('change', handler)

    this.log('added page listeners')
  }

  static getViewerContainer(iframe) {
    return new Promise((resolve) => {
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
  }

  onRenderToolbar = e => this.addListeners(e.reader)

  startup() {
    this.log("registering renderToolbar listener");
    Zotero.Reader.registerEventListener('renderToolbar', this.onRenderToolbar, this.id);
  }

  shutdown() {
    this.log("unregistering renderToolbar listener");
    Zotero.Reader.unregisterEventListener('renderToolbar', this.onRenderToolbar);
  }

  log(msg) {
    Zotero.debug(`${this.id}: ${msg}`);
  }

  static getScrollTarget(viewer, page) {
    const xOffset = (page.clientWidth - viewer.clientWidth) * 0.5;
    const yOffset = (page.clientHeight - viewer.clientHeight) * 0.5;
    return {
      top: page.offsetTop + yOffset,
      left: page.offsetLeft + xOffset,
    }
  }

  static getCurrentPageIndex() {
    return Zotero.Reader._readers[0]._internalReader._state.primaryViewState.pageIndex
  }

  static getCurrentPage(viewer) {
    let current;
    const pages = viewer.querySelectorAll('.pdfViewer .page');
    for (const p of pages) {
      if (Math.abs(p.offsetTop - viewer.scrollTop) < 5) {
        return p;
      }
    }
    return null;
  }
}
