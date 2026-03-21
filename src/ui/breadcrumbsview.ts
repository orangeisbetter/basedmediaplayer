import { Album } from "../album.ts";
import { Artist } from "../artist.ts";
import { BrowserState, MusicBrowser } from "../musicbrowser.ts";

export class BreadcrumbsView {
    private static breadcrumbs: HTMLDivElement;

    private static delimiter: DocumentFragment;
    private static root: HTMLDivElement;
    private static collection: HTMLDivElement;
    private static album: HTMLDivElement;
    private static artist: HTMLDivElement;

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

        this.artist = document.createElement("div");
        this.artist.style.display = "contents";

        this.breadcrumbs.appendChild(this.artist);

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

        if (state.collection) {
            for (const collection of state.collection.getCollectionPath()) {
                this.collection.appendChild(this.delimiter.cloneNode(true));

                const node = document.createElement("a");
                node.textContent = collection.name;
                node.addEventListener("click", () => MusicBrowser.navigate({
                    collection: collection
                }));

                this.collection.appendChild(node);
            }
        }

        this.album.innerHTML = "";
        this.artist.innerHTML = "";

        if (state.albumId !== null) {
            this.album.appendChild(this.delimiter.cloneNode(true));

            const album = Album.byID(state.albumId)!;

            const albumNode = document.createElement("a");
            albumNode.textContent = album?.name ?? "Unknown Album";
            albumNode.addEventListener("click", () => MusicBrowser.navigate({
                collection: state.collection,
                albumId: state.albumId
            }));

            this.album.appendChild(albumNode);

            // Album artist

            this.artist.appendChild(this.delimiter.cloneNode(true));

            const artistNode = document.createElement("a");

            if (album.artist === undefined) {
                artistNode.textContent = "Unknown artist";
            } else {
                const artist = Artist.byID(album.artist)!;
                artistNode.textContent = artist.name ?? "Unknown Artist";
                artistNode.addEventListener("click", () => MusicBrowser.navigate({
                    collection: state.collection,
                    artistId: album.artist
                }));
            }

            this.artist.appendChild(artistNode);

            return;
        }

        if (state.artistId !== null) {
            this.artist.appendChild(this.delimiter.cloneNode(true));

            const artist = Artist.byID(state.artistId);

            const node = document.createElement("a");
            node.textContent = artist?.name ?? "Unknown Artist";
            node.addEventListener("click", () => MusicBrowser.navigate({
                collection: state.collection,
                artistId: state.artistId
            }));

            this.artist.appendChild(node);
        }
    }
}