import { Album } from "../album.ts";
import { Artist } from "../artist.ts";
import { Collection } from "../data/collection.ts";
import { BrowserState, MusicBrowser } from "../musicbrowser.ts";

export class BreadcrumbsView {
    private static breadcrumbs: HTMLDivElement;

    private static delimiter: DocumentFragment;
    private static root: HTMLDivElement;
    private static collection: HTMLDivElement;
    private static album: HTMLDivElement;
    private static artist: HTMLDivElement;

	private static collectionChangeHandlers: { collection: Collection, handler: (_: Collection) => void }[] = [];

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

		{
			const rootItem = document.createElement("a");
			rootItem.title = rootItem.textContent = "Local library";
			rootItem.addEventListener("click", () => MusicBrowser.navigate({}));
			this.root.appendChild(rootItem);
		}

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

		MusicBrowser.events.locationChange.addListener(state => this.update(state));
    }

    private static update(state: BrowserState) {
		// Remove stale event handlers
		for (const item of this.collectionChangeHandlers) {
			item.collection.events.selfChange.removeListener(item.handler);
		}
		this.collectionChangeHandlers.length = 0;

        this.collection.innerHTML = "";

        if (state.collection) {
			for (let collection: Collection | null = state.collection; collection !== null; collection = collection.getParent()) {
				const node = document.createElement("a");
				node.title = node.textContent = collection.getName();
				node.addEventListener("click", () => MusicBrowser.navigate({
					collection: collection
				}));

				this.collection.prepend(node);

				this.collection.prepend(this.delimiter.cloneNode(true));

				const selfChangeHandler = (collection: Collection) => {
					node.title = node.textContent = collection.getName();
				};
				collection.events.selfChange.addListener(selfChangeHandler);
				this.collectionChangeHandlers.push({ collection, handler: selfChangeHandler });
			}
        }

        this.album.innerHTML = "";
        this.artist.innerHTML = "";

        if (state.albumId !== null) {
            this.album.appendChild(this.delimiter.cloneNode(true));

            const album = Album.byID(state.albumId)!;

            const albumNode = document.createElement("a");
			albumNode.title = albumNode.textContent = album?.name ?? "Unknown Album";
            albumNode.addEventListener("click", () => MusicBrowser.navigate({
                collection: state.collection,
                albumId: state.albumId
            }));

            this.album.appendChild(albumNode);

            // Album artist

            this.artist.appendChild(this.delimiter.cloneNode(true));

            const artistNode = document.createElement("a");

            if (album.artist === undefined) {
				artistNode.title = artistNode.textContent = "Unknown artist";
            } else {
                const artist = Artist.byID(album.artist)!;
				artistNode.title = artistNode.textContent = artist.name;
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
			node.title = node.textContent = artist?.name ?? "Unknown Artist";
            node.addEventListener("click", () => MusicBrowser.navigate({
                collection: state.collection,
                artistId: state.artistId
            }));

            this.artist.appendChild(node);
        }
    }
}