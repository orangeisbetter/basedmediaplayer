import { IDBPDatabase } from "idb";
import { Album } from "../album.ts";
import { Collection } from "../collection.ts";
import { Player } from "../player.ts";
import { Playlist } from "../playlist.ts";
import { convertTime } from "../time.ts";
import { Track } from "../track.ts";
import { CompareEntry, compareSmartAlpha, compareStack, compareUndefinedLast, numberCompare } from "../util/sort.ts";
import { Artist } from "../artist.ts";
import { SelectableList } from "./selectablelist.ts";
import { BrowserState, MusicBrowser } from "../musicbrowser.ts";
import { MenuSystem } from "./menu.ts";
import { getTracksMenuItems } from "./menus.ts";
import { Keyboard } from "../keyboard.ts";

declare const template_album: HTMLTemplateElement;
declare const template_track_list_item: HTMLTemplateElement;
declare const template_artist_list_item: HTMLTemplateElement;

type AlbumClickHandler = (albumId: number, collection: Collection) => void;
type BrowserMode = "artists" | "albums" | "tracks";
type AlbumSortingMode = "album_name" | "album_artist";
type TrackSortingMode = string;

const DEFAULT_ALBUM_NAME = "Unknown album";
const DEFAULT_ARTIST_NAME = "Unknown artist";

export class MusicBrowserView {
    private static db: IDBPDatabase;

    private static rootElement: HTMLDivElement;

    private static albumsList: HTMLDivElement;

    private static artistsList: HTMLTableSectionElement;
	private static artistIds: number[] = [];
    private static artistsSelList: SelectableList;

    private static tracksList: HTMLTableSectionElement;
	private static trackIds: number[] = [];
    private static tracksSelList: SelectableList;

    private static modeContainer: HTMLElement;
    private static modeSelect: HTMLSelectElement;

    private static sortContainer: HTMLElement;
    private static sortSelect: HTMLSelectElement;

	private static searchBar: HTMLInputElement;
	private static searchQuery: string = "";

    private static breadcrumbs: HTMLDivElement;

    private static browserMode: BrowserMode;
    private static albumSortMode: AlbumSortingMode;
    private static trackSortMode: TrackSortingMode;

    constructor() {
        throw Error("This static class cannot be instantiated");
    }

    static init(db: IDBPDatabase, element: HTMLDivElement) {
        this.db = db;

        this.rootElement = element;

        this.albumsList = this.rootElement.querySelector(".albums-list")!;

        this.artistsList = this.rootElement.querySelector(".artists-list tbody")!;
        this.artistsSelList = SelectableList.register(this.artistsList);

        this.tracksList = this.rootElement.querySelector(".tracks-list tbody")!;
        this.tracksSelList = SelectableList.register(this.tracksList);
		
		MenuSystem.setContextMenu(this.tracksList, () => {
			const selectedIndices = this.tracksSelList.getSelected();
			const selectedTrackIds = selectedIndices.map(index => this.trackIds[index]);
			if (selectedTrackIds.length == 0) return null;
			return {
				menuitems: [
					{
						kind: "item",
						text: "Play all",
						default: true,
						click: () => this.playAllTracks(selectedIndices[0])
					},
					{ kind: "separator" },
					getTracksMenuItems(selectedTrackIds),
					// { kind: "separator" },
					// {
					// 	kind: "item",
					// 	text: "Copy metadata as TSV",
					// 	click: () => this.copyAsTSV()
					// }
				]
			}
		});

		MenuSystem.setContextMenu(this.artistsList, () => {
			const selectedIds = this.artistsSelList.getSelected(info => this.artistIds[info.index]);
			if (selectedIds.length === 0) return null;
			return {
				menuitems: [
					{
						kind: "item",
						text: "View",
						default: true,
						click: selectedIds.length === 1 ? () => MusicBrowser.navigate({
							collection: MusicBrowser.collection,
							artistId: selectedIds[0]
						}) : undefined
					}
				]
			}
		});

        this.modeContainer = document.querySelector("header #main_view_select")!;
        this.modeSelect = this.modeContainer.querySelector("select, :scope:where(select)")!;

        this.sortContainer = document.querySelector("header #main_view_sort")!;
        this.sortSelect = this.sortContainer.querySelector("select, :scope:where(select)")!;

		this.searchBar = document.querySelector("header #search-bar")!;

        this.modeSelect.addEventListener("change", () => {
            const browserMode = this.modeSelect.value as BrowserMode;
            this.browserMode = browserMode;
            this.rootElement.dataset.mode = this.browserMode;
            this.db.put("config", this.browserMode, "browser_mode");
            this.update();
        });

        this.sortSelect.addEventListener("change", () => {
            switch (this.browserMode) {
                case "artists":
                    break;
                case "albums":
                    this.albumSortMode = this.sortSelect.value as AlbumSortingMode;
                    this.db.put("config", this.albumSortMode, "browser_album_sort_mode");
                    break;
                case "tracks":
                    this.trackSortMode = this.sortSelect.value as TrackSortingMode;
                    this.db.put("config", this.albumSortMode, "browser_track_sort_mode");
                    break;
            }
            this.update();
        });

        const albumSort = db.get("config", "browser_album_sort_mode").then(albumSortMode => this.albumSortMode = albumSortMode);
        const trackSort = db.get("config", "browser_track_sort_mode").then(trackSortMode => this.trackSortMode = trackSortMode);

        db.get("config", "browser_mode").then((browserMode: BrowserMode) => {
            this.browserMode = browserMode;
            this.modeSelect.value = this.browserMode;
            this.modeContainer.style.display = "";
            this.rootElement.dataset.mode = this.browserMode;

            switch (browserMode) {
                case "artists":
                    Promise.resolve().then(() => this.update());
                    break;
                case "albums":
                    albumSort.then(() => this.update());
                    break;
                case "tracks":
                    trackSort.then(() => this.update());
                    break;
            }
        });

		Keyboard.register("printable", () => {
			this.searchBar.focus();
			return false;
		});

		this.searchBar.addEventListener("input", () => {
			this.searchQuery = this.searchBar.value;
			this.update();
		});

        MusicBrowser.attachObserver(this.browserObserver.bind(this));
    }

    private static browserObserver(state: BrowserState) {
        if (state.albumId !== null || state.artistId !== null) {
            this.hide();
            return;
        }

        this.show();
        this.update();
    }

    static updateSortComponent() {
        switch (this.browserMode) {
            case "artists":
                this.sortContainer.style.display = "none";
                break;
            case "albums":
                this.sortContainer.style.display = "";
                this.sortSelect.options.length = 0;
                this.sortSelect.options.add(new Option("Album artist", "album_artist"));
                this.sortSelect.options.add(new Option("Album name", "album_name"));
                this.sortSelect.value = this.albumSortMode;
                break;
            case "tracks":
                this.sortContainer.style.display = "none";
                break;
        }
    }

    static show() {
        this.rootElement.style.display = "";
        this.modeContainer.style.display = "";
		this.searchBar.style.display = "";
        this.updateSortComponent();
    }
	
    static hide() {
		this.rootElement.style.display = "none";
        this.modeContainer.style.display = "none";
        this.sortContainer.style.display = "none";
		this.searchBar.style.display = "none";
    }

    static update() {
		if (MusicBrowser.albumId !== null || MusicBrowser.artistId !== null) return;

        this.updateSortComponent();

        switch (this.browserMode) {
            case "albums":
                this.showAlbums();
                break;
            case "artists":
                this.showArtists();
                break;
            case "tracks":
                this.showTracks();
                break;
        }
    }

	private static readonly filterAlbum = (album: Album) => {
		const words = this.searchQuery.split(" ").map(word => word.toLowerCase()).filter(word => word !== "");
		const keys = [album.name, album.getArtistName()]
			.map(key => key?.toLowerCase());
		return words.every(word => keys.some(key => key?.includes(word)));
	}

    static showAlbums() {
		const albums = (MusicBrowser.collection ? Array.from(MusicBrowser.collection.getAlbumIds()) : Album.getAllIds())
			.map(albumId => Album.byID(albumId)!)
			.filter(this.filterAlbum);

        switch (this.albumSortMode) {
            case "album_name":
				albums.sort(compareStack([
                    new CompareEntry(album => album.name, compareUndefinedLast(compareSmartAlpha)),
                    new CompareEntry(album => album.id, numberCompare)
				]));
                break;
            case "album_artist":
				albums.sort(compareStack([
                    new CompareEntry(album => album.getArtistName(), compareUndefinedLast(compareSmartAlpha)),
                    new CompareEntry(album => album.name, compareUndefinedLast(compareSmartAlpha)),
                    new CompareEntry(album => album.id, numberCompare)
				]));
                break;
        }

		for (const album of albums) {
			const existing = this.albumsList.querySelector(`[data-album-id="${album.id}"]`);
			if (existing) {
				this.albumsList.appendChild(existing);
			} else {
				this.albumsList.appendChild(this.getAlbumElement(album));
			}
		}

		const currentIds = new Set(albums.map(a => a.id));
		this.albumsList.querySelectorAll("[data-album-id]").forEach(el => {
			if (!currentIds.has(Number(el.getAttribute("data-album-id")))) {
				el.remove();
			}
		});
    }

    private static getAlbumElement(album: Album): DocumentFragment {
        const clone = document.importNode(template_album.content, true);
		clone.firstElementChild!.setAttribute("data-album-id", `${album.id}`);

        const albumClick = function () {
            MusicBrowser.modify(state => state.albumId = album.id);
        }

        const cover: HTMLImageElement = clone.querySelector(".cover")!;
        cover.src = album.getCoverURL();
        cover.addEventListener("click", albumClick);

        const albumName: HTMLElement = clone.querySelector(".album-name")!;
        albumName.textContent = album.name ?? DEFAULT_ALBUM_NAME;
        albumName.title = album.name ?? DEFAULT_ALBUM_NAME;
        albumName.addEventListener("click", albumClick);

        const albumArtist: HTMLElement = clone.querySelector(".album-artist")!;
        const albumArtistName = album.getArtistName() ?? DEFAULT_ARTIST_NAME;
        albumArtist.textContent = albumArtistName;
        albumArtist.title = albumArtistName;

        albumArtist.addEventListener("click", () => MusicBrowser.navigate({
            collection: MusicBrowser.collection,
            artistId: album.artist
        }));

        return clone;
    }

	private static readonly filterArtist = (artist: Artist) => {
		const words = this.searchQuery.split(" ").map(word => word.toLowerCase()).filter(word => word !== "");
		const keys = [artist.name]
			.map(key => key?.toLowerCase());
		return words.every(word => keys.some(key => key?.includes(word)));
	}

    static showArtists() {
        let artistIds;
        if (MusicBrowser.collection) {
            const artistSet = new Set<number>();

            const albumIds = Array.from(MusicBrowser.collection.getAlbumIds());
            for (const albumId of albumIds) {
                const album = Album.byID(albumId)!;
                if (album.artist) artistSet.add(album.artist);
            }

            const trackIds = Array.from(MusicBrowser.collection.getTrackIds());
            for (const trackId of trackIds) {
                const track = Track.byID(trackId)!;
                track.artists.forEach(artist => artistSet.add(artist));
            }

            artistIds = Array.from(artistSet);
        } else {
            artistIds = Array.from(Artist.artists.keys());
        }

        const artists = artistIds
			.map(artistId => Artist.byID(artistId)!)
			.filter(this.filterArtist);

        artists.sort(compareStack([
            new CompareEntry(artist => artist.name, compareUndefinedLast(compareSmartAlpha)),
            new CompareEntry(artist => artist.id, numberCompare)
        ]));
		this.artistIds = artists.map(artist => artist.id);

		for (const artist of artists) {
			const existing = this.artistsList.querySelector(`[data-artist-id="${artist.id}"]`);
			if (existing) {
				this.artistsList.appendChild(existing);
			} else {
				this.artistsList.appendChild(this.getArtistElement(artist));
			}
		}

		const currentIds = new Set(artists.map(a => a.id));
		this.artistsList.querySelectorAll("[data-artist-id]").forEach(el => {
			if (!currentIds.has(Number(el.getAttribute("data-album-id")))) {
				el.remove();
			}
		});
    }

    private static getArtistElement(artist: Artist): DocumentFragment {
        const clone = document.importNode(template_artist_list_item.content, true);
		clone.firstElementChild!.setAttribute("data-artist-id", `${artist.id}`);

        const cells = clone.querySelectorAll("td");
        cells[0].title = cells[0].textContent = artist.name;
        cells[1].textContent = String(artist.albumIds.size);
        cells[2].textContent = String(artist.trackIds.size);

        return clone;
    }

	private static readonly filterTracks = (track: Track) => {
		const words = this.searchQuery.split(" ").map(word => word.toLowerCase()).filter(word => word !== "");
		const album = Album.byID(track.albumId)!;
		const keys = [track.title, Artist.getArtistString(track.artists), album.name, album.getArtistName()]
			.map(key => key?.toLowerCase());
		return words.every(word => keys.some(key => key?.includes(word)));
	}

    static showTracks() {
        const allTracks = Array.from(Track.getAllIds());
        const collectionTracks = MusicBrowser.collection?.getTrackIds();
        const trackIds = collectionTracks ? allTracks.filter(x => collectionTracks.has(x)) : allTracks;

        const tracks = trackIds
			.map(trackId => Track.byID(trackId)!)
			.filter(this.filterTracks);

		tracks.sort(compareStack([
            new CompareEntry(track => Album.byID(track.albumId)!.getArtistName(), compareUndefinedLast(compareSmartAlpha)),
            new CompareEntry(track => Album.byID(track.albumId)!.name, compareUndefinedLast(compareSmartAlpha)),
            new CompareEntry(track => track.disc, (a, b) => (a ?? 0) - (b ?? 0)),
            new CompareEntry(track => track.no, (a, b) => (a ?? 0) - (b ?? 0)),
		]));
		this.trackIds = tracks.map(track => track.id);

		for (const track of tracks) {
			const album = Album.byID(track.albumId)!;
			const existing = this.tracksList.querySelector(`[data-track-id="${track.id}"]`);
			if (existing) {
				this.tracksList.appendChild(existing);
			} else {
				this.tracksList.appendChild(this.getTrackElement(album, track));
			}
		}

		const currentIds = new Set(tracks.map(a => a.id));
		this.tracksList.querySelectorAll("[data-track-id]").forEach(el => {
			if (!currentIds.has(Number(el.getAttribute("data-track-id")))) {
				el.remove();
			}
		});
    }

    private static getTrackElement(album: Album, track: Track): DocumentFragment {
        const clone = document.importNode(template_track_list_item.content, true);
		clone.firstElementChild!.setAttribute("data-track-id", `${track.id}`);

        const cells = clone.querySelectorAll("td");
        cells[0].title = cells[0].textContent = album.name ?? DEFAULT_ALBUM_NAME;
        cells[1].title = cells[1].textContent = album.getArtistName() ?? DEFAULT_ARTIST_NAME;
        cells[2].title = cells[2].textContent = track.disc ? `${track.disc}-${track.no}` : `${track.no ?? ""}`;
        cells[3].title = cells[3].textContent = track.title;
        cells[4].title = cells[4].textContent = convertTime(track.duration);
        cells[5].title = cells[5].textContent = Artist.getArtistString(track.artists) ?? "";

        return clone;
    }

    private static playAllTracks(startIndex?: number) {
		startIndex ??= 0;

        Playlist.clear();
        Playlist.add(...this.trackIds);
        Playlist.changeTrack(startIndex);
        Player.play();
    }
}