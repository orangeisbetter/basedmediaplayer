import { Album } from "../album.ts";
import { Artist } from "../artist.ts";
import { BrowserState, MusicBrowser } from "../musicbrowser.ts";
import { Player } from "../player.ts";
import { Playlist } from "../playlist.ts";
import { convertTime } from "../time.ts";
import { Track } from "../track.ts";
import { CompareEntry, compareSmartAlpha, compareStack, compareUndefinedLast, numberCompare } from "../util/sort.ts";
import { Menu, MenuSystem } from "./menu.ts";
import { SelectableList } from "./selectablelist.ts";

export class ArtistDisplay {
    private static rootElement: HTMLDivElement;

    private static albumsPlayAllButton: HTMLButtonElement;
    private static albumsShufflePlayButton: HTMLButtonElement;
    private static albumsAddToPlaylistButton: HTMLButtonElement;

    private static tracksPlayAllButton: HTMLButtonElement;
    private static tracksShufflePlayButton: HTMLButtonElement;
    private static tracksAddToPlaylistButton: HTMLButtonElement;

    private static artistNameElement: HTMLElement;
    private static artistInfoElement: HTMLElement;

    private static albumsSection: HTMLDivElement;
    private static tracksSection: HTMLDivElement;

    private static albumsList: HTMLDivElement;

    private static trackTableBody: HTMLTableSectionElement;
    private static list: SelectableList;

    private static trackIds: number[] = [];
    private static albumIds: number[] = [];

    private static menu: Menu = {
        menuitems: [
            {
                kind: "item",
                text: "Play all",
                default: true,
                click: () => this.playAllTracks()
            },
            { kind: "separator" },
            {
                kind: "item",
                text: "Play",
                click: () => this.play()
            },
            {
                kind: "item",
                text: "Play next",
                click: () => this.playNext()
            },
            {
                kind: "item",
                text: "Add to playlist",
                click: () => this.addToPlaylist()
            },
            { kind: "separator" },
            {
                kind: "item",
                text: "Add to collection",
            },
            { kind: "separator" },
            {
                kind: "item",
                text: "Copy metadata as TSV",
                click: () => this.copyAsTSV()
            }
        ]
    };

    constructor() {
        throw Error("This static class cannot be instantiated");
    }

    static init() {
        this.rootElement = document.querySelector("#artist-view")!;

        this.albumsPlayAllButton = this.rootElement.querySelector("#btn-albums-play-all")!;
        this.albumsShufflePlayButton = this.rootElement.querySelector("#btn-albums-shuffle-play")!;
        this.albumsAddToPlaylistButton = this.rootElement.querySelector("#btn-albums-add-to-playlist")!;

        this.albumsPlayAllButton.addEventListener("click", () => this.albumsPlayAllHandler());
        this.albumsShufflePlayButton.addEventListener("click", () => this.albumsShufflePlayHandler());
        this.albumsAddToPlaylistButton.addEventListener("click", () => this.albumsAddToPlaylistHandler());

        this.tracksPlayAllButton = this.rootElement.querySelector("#btn-tracks-play-all")!;
        this.tracksShufflePlayButton = this.rootElement.querySelector("#btn-tracks-shuffle-play")!;
        this.tracksAddToPlaylistButton = this.rootElement.querySelector("#btn-tracks-add-to-playlist")!;

        this.tracksPlayAllButton.addEventListener("click", () => this.tracksPlayAllHandler());
        this.tracksShufflePlayButton.addEventListener("click", () => this.tracksShufflePlayHandler());
        this.tracksAddToPlaylistButton.addEventListener("click", () => this.tracksAddToPlaylistHandler());

        this.artistNameElement = this.rootElement.querySelector("#artist-name")!;
        this.artistInfoElement = this.rootElement.querySelector("#artist-info")!;

        this.albumsSection = this.rootElement.querySelector("#albums-section")!;
        this.tracksSection = this.rootElement.querySelector("#tracks-section")!;

        this.albumsList = this.rootElement.querySelector("#albums")!;

        this.trackTableBody = this.rootElement.querySelector("tbody")!;
        this.list = SelectableList.register(this.trackTableBody);

        MenuSystem.setContextMenu(this.trackTableBody, () => {
            if (this.list.getSelected().length > 0) {
                return this.menu
            } else {
                return null;
            }
        });

        MusicBrowser.attachObserver(state => this.browserObserver(state));
    }

    private static browserObserver(state: BrowserState) {
        if (state.artistId === null) {
            this.hide();
            return;
        }

        this.show();
        this.displayArtist();
    }

    static show() {
        this.rootElement.style.display = "";
    }

    static hide() {
        this.rootElement.style.display = "none";
    }

    private static displayArtist() {
        const artist = Artist.byID(MusicBrowser.artistId!)!;

        this.artistNameElement.textContent = artist.name;

        const numAlbums = artist.albumIds.length;
        const numTracks = artist.trackIds.length;
        this.artistInfoElement.textContent = `${numAlbums} album${numAlbums != 1 ? "s" : ""} • ${numTracks} track${numTracks != 1 ? "s" : ""}`;

        const collectionAlbums = MusicBrowser.collection?.getAlbumIds();
        const albumIdsUnsorted = collectionAlbums
            ? artist.albumIds.filter(albumId => collectionAlbums.has(albumId))
            : artist.albumIds;
        const albums = albumIdsUnsorted.map(albumId => Album.byID(albumId)!);
        albums.sort(compareStack<Album>([
            new CompareEntry(album => album.name, compareUndefinedLast(compareSmartAlpha)),
            new CompareEntry(album => album.id, numberCompare)
        ]));
        this.albumIds = albums.map(album => album.id);

        if (albums.length > 0) {
            this.albumsSection.style.display = "";
            this.albumsList.innerHTML = "";
            for (const album of albums) {
                this.albumsList.appendChild(this.getAlbumElement(album, artist));
            }
        } else {
            this.albumsSection.style.display = "none";
        }

        const collectionTracks = MusicBrowser.collection?.getTrackIds();
        const trackIdsUnsorted = collectionTracks
            ? artist.trackIds.filter(trackId => collectionTracks.has(trackId))
            : artist.trackIds;
        const tracks = trackIdsUnsorted.map(trackId => Track.byID(trackId)!);
        tracks.sort(compareStack([
            new CompareEntry(track => Album.byID(track.albumId)!.getArtistName(), compareUndefinedLast(compareSmartAlpha)),
            new CompareEntry(track => Album.byID(track.albumId)!.name, compareUndefinedLast(compareSmartAlpha)),
            new CompareEntry(track => track.disc, (a, b) => (a ?? 0) - (b ?? 0)),
            new CompareEntry(track => track.no, (a, b) => (a ?? 0) - (b ?? 0)),
        ]));
        this.trackIds = tracks.map(track => track.id);

        if (tracks.length > 0) {
            this.tracksSection.style.display = "";
            this.trackTableBody.innerHTML = "";
            for (const track of tracks) {
                this.trackTableBody.appendChild(this.getTrackElement(track));
            }
        } else {
            this.tracksSection.style.display = "none"
        }

        this.rootElement.scroll({ top: 0 });
    }

    private static getAlbumElement(album: Album, artist: Artist): HTMLDivElement {
        const albumElement = document.createElement("div");
        albumElement.className = "album";

        const coverBox = document.createElement("div");
        coverBox.className = "cover-box";

        const albumClick = function () {
            MusicBrowser.navigate({
                collection: MusicBrowser.collection,
                albumId: album.id
            });
        }

        const cover = document.createElement("img");
        cover.className = "cover";
        cover.src = album.getCoverURL();
        cover.addEventListener("click", albumClick);
        coverBox.appendChild(cover);

        const albumName = document.createElement("div");
        albumName.className = "album-name ellipsis";
        albumName.title = albumName.textContent = album.name ?? "Unknown album";
        albumName.addEventListener("click", albumClick);

        const albumArtist = document.createElement("div");
        albumArtist.className = "album-artist ellipsis";
        albumArtist.title = albumArtist.textContent = artist.name ?? "Unknown album";

        albumElement.appendChild(coverBox);
        albumElement.appendChild(albumName);
        albumElement.appendChild(albumArtist);

        return albumElement;
    }

    private static getTrackElement(track: Track): HTMLTableRowElement {
        const row = document.createElement("tr");

        const album = document.createElement("td");
        album.textContent = Album.byID(track.albumId)!.name ?? "Unknown album";
        row.appendChild(album);

        const number = document.createElement("td");
        number.textContent = track.disc ? `${track.disc}-${track.no}` : `${track.no ?? ""}`;
        row.appendChild(number);

        const title = document.createElement("td");
        title.textContent = track.title;
        row.appendChild(title);

        const duration = document.createElement("td");
        duration.textContent = convertTime(track.duration);
        row.appendChild(duration);

        const artist = document.createElement("td");
        artist.textContent = Artist.getArtistString(track.artists);
        row.appendChild(artist);

        const composer = document.createElement("td");
        composer.textContent = track.composer?.join(", ") ?? "";
        row.appendChild(composer);

        return row;
    }

    private static getAlbumsTracks(): number[] {
        const trackIds = [];
        for (const albumId of this.albumIds) {
            const album = Album.byID(albumId)!;
            trackIds.push(...album.trackIds);
        }
        return trackIds;
    }

    private static playAllTracks(index?: number) {
        // Get index from beginning of selection if not specified
        index ??= this.list.getSelected()[0];

        Playlist.clear();
        Playlist.add(...this.trackIds);
        Playlist.changeTrack(index);
        Player.play();
    }

    private static albumsPlayAllHandler() {
        const trackIds = this.getAlbumsTracks();

        Playlist.clear();
        Playlist.add(...trackIds);
        Playlist.changeTrack(0);
        Player.play();
    }

    private static albumsAddToPlaylistHandler() {
        const trackIds = this.getAlbumsTracks();
        Playlist.add(...trackIds);
    }

    private static albumsShufflePlayHandler() {
        const trackIds = this.getAlbumsTracks();
        Playlist.clear();
        Playlist.add(...trackIds);
        Playlist.shuffle();
        Playlist.changeTrack(0);
        Player.play();
    }

    private static tracksPlayAllHandler() {
        this.playAllTracks(0);
    }

    private static tracksAddToPlaylistHandler() {
        Playlist.add(...this.trackIds);
    }

    private static tracksShufflePlayHandler() {
        Playlist.clear();
        Playlist.add(...this.trackIds);
        Playlist.shuffle();
        Playlist.changeTrack(0);
        Player.play();
    }

    private static play() {
        const indices = this.list.getSelected();
        if (indices.length == 0) return; // How did we get here???
        const tracks = indices.map(index => this.trackIds[index]);
        Playlist.add(...tracks);
        Playlist.changeTrack(Playlist.getNumTracks() - tracks.length);
        Player.play();
    }

    private static playNext() {
        const indices = this.list.getSelected();
        const tracks = indices.map(index => this.trackIds[index]);
        Playlist.insertNext(...tracks);
    }

    private static addToPlaylist() {
        const indices = this.list.getSelected();
        const tracks = indices.map(index => this.trackIds[index]);
        Playlist.add(...tracks);
    }

    private static copyAsTSV() {
        const indices = this.list.getSelected();
        const tsvData = indices
            .map(index => {
                const track = Track.byID(this.trackIds[index])!;
                const album = Album.byID(track.albumId)!;
                const columns = [
                    album.id ?? "",
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
}