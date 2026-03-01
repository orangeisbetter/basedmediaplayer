import { Album } from "../album.ts";
import { Collection } from "../collection.ts";
import { BrowserState, MusicBrowser } from "../musicbrowser.ts";

export class BreadcrumbsView {
    private static breadcrumbs: HTMLDivElement;

    private static delimiter: DocumentFragment;
    private static root: HTMLDivElement;
    private static collection: HTMLDivElement;
    private static album: HTMLDivElement;

    static init() {
        this.breadcrumbs = document.querySelector("#breadcrumbs")!;

        {
            const template = document.createElement("template");
            template.innerHTML = `<svg width="16" height="16" style="rotate:90deg" viewBox="0 0 24 24"><path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6l-6 6z"/></svg>`;
            this.delimiter = template.content;
        }

        this.root = document.createElement("div");
        this.root.style.display = "contents";

        this.root.appendChild(this.delimiter.cloneNode(true));

        const rootItem = document.createElement("a");
        rootItem.textContent = "Local library";
        rootItem.addEventListener("click", () => MusicBrowser.navigate({}));
        this.root.appendChild(rootItem);

        this.breadcrumbs.appendChild(this.root);

        this.collection = document.createElement("div");
        this.collection.style.display = "contents";

        this.breadcrumbs.appendChild(this.collection);

        this.album = document.createElement("div");
        this.album.style.display = "contents";

        this.breadcrumbs.appendChild(this.album);

        MusicBrowser.attachObserver(state => this.browserObserver(state));
    }

    private static browserObserver(state: BrowserState) {
        this.update(state);
    }

    private static update(state: BrowserState) {
        this.collection.innerHTML = "";

        const doCollections = (collection: Collection) => {
            const parent = collection.getParentCollection();
            if (parent !== null) {
                doCollections(parent);
            }
            this.collection.appendChild(this.delimiter.cloneNode(true));

            const node = document.createElement("a");
            node.textContent = collection.name;
            node.addEventListener("click", () => MusicBrowser.navigate({
                collection: collection
            }));

            this.collection.appendChild(node);
        }

        if (state.collection) {
            doCollections(state.collection);
        }

        this.album.innerHTML = "";

        if (state.albumId !== null) {
            // this.album.appendChild(this.delimiter.cloneNode(true));

            // const albumDescriptor = document.createElement("span");
            // albumDescriptor.textContent = "Album";
            // this.album.appendChild(albumDescriptor);

            this.album.appendChild(this.delimiter.cloneNode(true));

            const album = Album.byID(state.albumId);

            const node = document.createElement("a");
            node.textContent = album?.name ?? "Unknown Album";
            node.addEventListener("click", () => MusicBrowser.navigate({
                collection: state.collection,
                albumId: state.albumId
            }));

            this.album.appendChild(node);
        }
    }
}