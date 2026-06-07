import { Album } from "../album.ts";
import { Artist } from "../artist.ts";
import { Collection } from "../collection.ts";
import { BrowserState, MusicBrowser } from "../musicbrowser.ts";
import { Player } from "../player.ts";
import { Playlist } from "../playlist.ts";
import { convertTime } from "../time.ts";
import { Track } from "../track.ts";
import { MenuSystem } from "./menu.ts";
import { getTracksMenuItems } from "./menus.ts";
import { SelectableList } from "./selectablelist.ts";

declare const template_album_view_track: HTMLTemplateElement;

export class AlbumDisplay {
    private static rootElement: HTMLDivElement;

    private static playAllButton: HTMLButtonElement;
    private static shufflePlayButton: HTMLButtonElement;
    private static addToPlaylistButton: HTMLButtonElement;
    private static trackTableBody: HTMLTableSectionElement;

    private static coverImageElement: HTMLImageElement;
    private static coverLeftButton: HTMLButtonElement;
    private static coverRightButton: HTMLButtonElement;
    private static coverIndexLabel: HTMLElement;
    private static albumNameElement: HTMLElement;
    private static albumArtistElement: HTMLAnchorElement;
    private static albumInfoElement: HTMLElement;

    private static coverIndex: number = 0;

    private static trackIds: number[] = [];
    private static list: SelectableList;
    private static lastAlbumId: number | null = null;
    private static lastCollection: Collection | null = null;

    constructor() {
        throw Error("This static class cannot be instantiated");
    }

    static init(element: HTMLDivElement) {
        this.rootElement = element;

        this.playAllButton = this.rootElement.querySelector("#play_all_btn")!;
        this.shufflePlayButton = this.rootElement.querySelector("#shuffle_play_btn")!;
        this.addToPlaylistButton = this.rootElement.querySelector("#add_to_playlist_btn")!;
        this.trackTableBody = this.rootElement.querySelector("tbody")!;

        this.coverImageElement = this.rootElement.querySelector("#album-cover-img")!;
        this.coverLeftButton = this.rootElement.querySelector("#cover-left-btn")!;
        this.coverRightButton = this.rootElement.querySelector("#cover-right-btn")!;
        this.coverIndexLabel = this.rootElement.querySelector("#cover-index-lbl")!;
        this.albumNameElement = this.rootElement.querySelector("#album-name")!;
        this.albumArtistElement = this.rootElement.querySelector("#album-artist")!;
        this.albumInfoElement = this.rootElement.querySelector("#album-info")!;

        this.playAllButton.addEventListener("click", () => this.playAllHandler());
        this.shufflePlayButton.addEventListener("click", () => this.shufflePlayHandler());
        this.addToPlaylistButton.addEventListener("click", () => this.addToPlaylistHandler());

        this.albumArtistElement.addEventListener("click", () => this.albumArtistClickHandler());

        this.list = SelectableList.register(this.trackTableBody);

        MenuSystem.setContextMenu(this.trackTableBody, () => {
            const selection = this.list.getSelected().map(index => this.trackIds[index]);
            if (selection.length == 0) return null;
            return {
                menuitems: [
                    {
                        kind: "item",
                        text: "Play all",
                        default: true,
                        click: () => this.playAll()
                    },
                    { kind: "separator" },
                    getTracksMenuItems(selection),
                    { kind: "separator" },
                    {
                        kind: "item",
                        text: "Copy metadata as TSV",
                        click: () => this.copyAsTSV()
                    }
                ]
            }
        });

        MusicBrowser.attachObserver(state => this.browserObserver(state));

        this.coverLeftButton.addEventListener("click", () => {
            if (this.coverIndex < 0) return;
            this.coverIndex--;

            const album = Album.byID(MusicBrowser.albumId!)!;
            this.coverImageElement.src = album.getCoverURL(this.coverIndex);

			this.updateCoverIndexLabel(album);

            this.enableDisableCoverButtons();
        });

        this.coverRightButton.addEventListener("click", () => {
            const album = Album.byID(MusicBrowser.albumId!)!;
            if (this.coverIndex >= album.covers.length - 1) return;
            this.coverIndex++;
            
            this.coverImageElement.src = album.getCoverURL(this.coverIndex);

			this.updateCoverIndexLabel(album);

            this.enableDisableCoverButtons();
        })
    }

	private static updateCoverIndexLabel(album: Album) {
		if (album.covers.length > 0) {
			this.coverIndexLabel.textContent = `${this.coverIndex + 1} / ${album.covers.length}`;
		} else {
			this.coverIndexLabel.textContent = `0 / 0`;
		}
	}

    private static enableDisableCoverButtons() {
        if (this.coverIndex > 0) {
            this.coverLeftButton.disabled = false;
        } else {
            this.coverLeftButton.disabled = true;
        }

        const album = Album.byID(MusicBrowser.albumId!)!;
        if (this.coverIndex < album.covers.length - 1) {
            this.coverRightButton.disabled = false;
        } else {
            this.coverRightButton.disabled = true;
        }
    }

    private static collectionTrackObserver = (collection: Collection) => {
        if (MusicBrowser.collection !== collection) return; // we don't care

        this.displayAlbum(false);
    }

    private static browserObserver(state: BrowserState) {
        this.lastCollection?.detachTrackObserver(this.collectionTrackObserver);
        this.lastCollection = null;

        if (state.albumId === null) {
            this.hide();
            return;
        }

        const reset = state.albumId !== this.lastAlbumId;

        this.show();
        this.displayAlbum(reset);

        this.lastAlbumId = state.albumId;

        MusicBrowser.collection?.attachTrackObserver(this.collectionTrackObserver);
        this.lastCollection = MusicBrowser.collection;
    }

    static show() {
        this.rootElement.style.display = "";
    }

    static hide() {
        this.rootElement.style.display = "none";
    }

    private static displayAlbum(reset: boolean) {
        const album = Album.byID(MusicBrowser.albumId!)!;

        if (reset) {
            this.coverIndex = 0;
        }

        this.trackTableBody.innerHTML = "";

        const collectionTracks = MusicBrowser.collection?.getTrackIds();
        this.trackIds = collectionTracks ? album.trackIds.filter(x => collectionTracks.has(x)) : album.trackIds;

        for (const trackId of this.trackIds) {
            const track = Track.byID(trackId)!;
            this.trackTableBody.appendChild(AlbumDisplay.getTrackElement(track));
        }

        this.coverImageElement.src = album.getCoverURL();

		this.updateCoverIndexLabel(album);

        this.enableDisableCoverButtons();

        this.albumNameElement.textContent = album.name ?? "Unknown album";
        this.albumArtistElement.textContent = album.getArtistName() ?? "Unknown artist";

		const trackYears = [...new Set(album.trackIds
			.map(trackId => {
				const track = Track.byID(trackId)!
				return track.year;
			})
			.filter(year => year !== undefined))];
		let yearText = null;
		if (trackYears.length > 1) {
			yearText = `${trackYears.reduce((prev, curr) => curr < prev ? curr : prev, Number.MAX_SAFE_INTEGER)}+`;
		} else if (trackYears.length == 1) {
			yearText = `${trackYears.reduce((prev, curr) => curr < prev ? curr : prev, Number.MAX_SAFE_INTEGER)}`;
		}
        const numTracks = this.trackIds.length;
        const duration = this.trackIds.reduce((prev, current) => prev + Track.byID(current)!.duration, 0);
        this.albumInfoElement.textContent = `${yearText !== null ? `${yearText} • ` : ""}${numTracks} track${numTracks != 1 ? "s" : ""} • ${convertTime(duration)}`;

        this.rootElement.scroll({ top: 0 });
    }

    private static getTrackElement(track: Track): DocumentFragment {
        const clone = document.importNode(template_album_view_track.content, true);

        const cells = clone.querySelectorAll("td");
        cells[0].textContent = track.disc ? `${track.disc}-${track.no}` : `${track.no ?? ""}`;
        cells[1].textContent = track.title;
        cells[2].textContent = convertTime(track.duration);
        cells[3].textContent = Artist.getArtistString(track.artists) ?? "";
        cells[4].textContent = track.composer?.join(", ") ?? "";

        return clone;
    }

    private static playAll(index?: number) {
        if (MusicBrowser.albumId === null) {
            throw new Error("Cannot play album, no album set!");
        }

        const album = Album.byID(MusicBrowser.albumId)!;

        const collectionTracks = MusicBrowser.collection?.getTrackIds();
        const trackIds = MusicBrowser.collection ? album.trackIds.filter(x => collectionTracks!.has(x)) : album.trackIds;

        // Get index from beginning of selection if not specified
        index ??= this.list.getSelected()[0];

        Playlist.clear();
        Playlist.add(...trackIds);
        Playlist.changeTrack(index);
        Player.play();
    }

    private static copyAsTSV() {
        const indices = this.list.getSelected();
        const tsvData = indices
            .map(index => {
                const track = Track.byID(this.trackIds[index])!;
                const columns = [
                    track.disc ?? "",
                    track.no ?? "",
                    track.title,
                    convertTime(track.duration),
                    track.artists?.join("\\\\") ?? "",
                    track.composer?.join("\\\\") ?? ""
                ];
                return columns.join("\t");
            })
            .join("\n");

        navigator.clipboard.writeText(tsvData);
    }

    private static playAllHandler() {
        this.playAll(0);
    }

    private static addToPlaylistHandler() {
        Playlist.add(...this.trackIds);
    }

    private static shufflePlayHandler() {
        Playlist.clear();
        Playlist.add(...this.trackIds);
        Playlist.shuffle();
        Playlist.changeTrack(0);
        Player.play();
    }

    private static albumArtistClickHandler() {
        const albumId = MusicBrowser.albumId;
        if (albumId === null) return;
        const album = Album.byID(albumId)!;
        if (album.artist === undefined) return;
        MusicBrowser.navigate({
            artistId: album.artist
        });
    }
}