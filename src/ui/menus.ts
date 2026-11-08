import { Collection } from "../data/collection.ts";
import { Player } from "../player.ts";
import { Playlist, PlaylistItem } from "../playlist.ts";
import { CompareEntry, compareSmartAlpha, compareStack, compareUndefinedLast } from "../util/sort.ts";
import { createCollectionDialog } from "./collectionoperations.ts";
import { MenuEntry } from "./menu.ts";

export function getTracksMenuItems(trackIds: number[], withCollections: boolean = true): MenuEntry {
	const common: MenuEntry = [
        {
            kind: "item",
            text: "Play",
            click: () => tracksPlay(trackIds)
        },
		{
			kind: "item",
			text: "Shuffle play",
			click: () => shufflePlay(trackIds)
		},
        () => ({
            kind: "item",
            text: "Play next",
			click: Playlist.getNumTracks() == 0 ? undefined : () => tracksPlayNext(trackIds)
        }),
        {
            kind: "item",
            text: "Add to playlist",
            click: () => tracksAddToPlaylist(trackIds)
        },
	];

	if (!withCollections) {
		return common;
	}

	const rootCollectionMenuItems: MenuEntry[] = Array.from(Collection.rootCollections)
		.sort(compareStack([
			new CompareEntry(collection => collection.getName(), compareUndefinedLast(compareSmartAlpha))
		]))
		.map(collection => getCollectionMenuItem(trackIds, collection));

    return [
		common,
        { kind: "separator" },
        {
            kind: "item",
            text: "Add to collection",
            submenu: {
                menuitems: [
					() => {
						if (rootCollectionMenuItems.length == 0) return null;
						return [
							rootCollectionMenuItems,
							{ kind: "separator" }
						];
					},
                    {
                        kind: "item",
                        text: "Add to new collection",
                        click: () => {
                            createCollectionDialog(null).then(collection => {
                                if (collection === null) return;
                                collection.addTracks(trackIds);
                            });
                        }
                    }
                ]
            }
        },
        () => {
            if (Collection.recentlyUsed === null) return null;
            const collection = Collection.recentlyUsed;
            return {
                kind: "item",
                text: `Add to collection '${collection.getName()}'`,
                click: () => collection.addTracks(trackIds)
            };
        },
        () => {
            const collections = Collection.getResidingCollections(trackIds);
            return Array.from(collections)
				.sort(compareStack([
					new CompareEntry(collection => collection.getName(), compareUndefinedLast(compareSmartAlpha))
				]))
				.map(collection => ({
					kind: "item",
					text: `Remove from collection '${collection.getName()}'`,
					click: () => collection.removeTracks(trackIds)
				}));
        }
    ];
}

function getCollectionMenuItem(trackIds: number[], collection: Collection): MenuEntry {
	const childrenCollectionMenus: MenuEntry[] = Array.from(collection.getChildren())
		.sort(compareStack([
			new CompareEntry(collection => collection.getName(), compareUndefinedLast(compareSmartAlpha))
		]))
		.map(collection => getCollectionMenuItem(trackIds, collection));

    return {
        kind: "item",
        text: collection.getName(),
        submenu: {
            menuitems: [
                {
                    kind: "item",
                    text: "Add here",
                    click: () => {
                        collection.addTracks(trackIds);
                    }
                },
				{ kind: "separator" },
                () => {
                    if (childrenCollectionMenus.length === 0) return null;
                    return [
						...childrenCollectionMenus,
						{ kind: "separator" },
                    ]
                },
                {
                    kind: "item",
                    text: "Add to new collection",
                    click: () => {
                        createCollectionDialog(collection).then(collection => {
                            if (collection === null) return;
                            collection.addTracks(trackIds);
                        });
                    }
                }
            ]
        }
    }
}

function tracksPlay(trackIds: number[]) {
	Playlist.clear();
    Playlist.add(...trackIds.map(PlaylistItem.createFromTrack));
    Playlist.changeTrack(0);
    Player.play();
}

function shufflePlay(trackIds: number[]) {
	Playlist.clear();
    Playlist.add(...trackIds.map(PlaylistItem.createFromTrack));
	Playlist.shuffle();
    Playlist.changeTrack(0);
    Player.play();
}

function tracksPlayNext(trackIds: number[]) {
    Playlist.insertNext(...trackIds.map(PlaylistItem.createFromTrack));
}

function tracksAddToPlaylist(trackIds: number[]) {
	if (Playlist.getNumTracks() == 0) {
		Playlist.add(...trackIds.map(PlaylistItem.createFromTrack));
		Playlist.changeTrack(0);
	} else {
		Playlist.add(...trackIds.map(PlaylistItem.createFromTrack));
	}
}