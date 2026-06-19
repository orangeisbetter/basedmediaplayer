import { Collection } from "../collection.ts";
import { Player } from "../player.ts";
import { Playlist } from "../playlist.ts";
import { CompareEntry, compareSmartAlpha, compareStack, compareUndefinedLast } from "../util/sort.ts";
import { createCollection } from "./createcollection.ts";
import { MenuEntry } from "./menu.ts";

export function getTracksMenuItems(trackIds: number[]): MenuEntry {
	const rootCollectionMenuItems: MenuEntry[] = Collection.rootCollections
		.map(collectionId => Collection.byID(collectionId)!)
		.sort(compareStack([
			new CompareEntry(collection => collection.name, compareUndefinedLast(compareSmartAlpha))
		]))
		.map(collection => getCollectionMenuItem(trackIds, collection));

    const thing: MenuEntry = [
        {
            kind: "item",
            text: "Play",
            click: () => tracksPlay(trackIds)
        },
        {
            kind: "item",
            text: "Play next",
			click: Playlist.getNumTracks() == 0 ? undefined : () => tracksPlayNext(trackIds)
        },
        {
            kind: "item",
            text: "Add to playlist",
            click: () => tracksAddToPlaylist(trackIds)
        },
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
                            createCollection(null).then(collection => {
                                if (collection === null) return;
                                collection.add(trackIds);
                            });
                        }
                    }
                ]
            }
        },
        () => {
            if (Collection.recentlyAdded === null) return null;
            const collection = Collection.recentlyAdded;
            return {
                kind: "item",
                text: `Add to collection '${collection.name}'`,
                click: () => collection.add(trackIds)
            };
        },
        () => {
            const collections = Collection.getResidingCollections(trackIds);
            return Array.from(collections)
				.sort(compareStack([
					new CompareEntry(collection => collection.name, compareUndefinedLast(compareSmartAlpha))
				]))
				.map(collection => ({
					kind: "item",
					text: `Remove from collection '${collection.name}'`,
					click: () => collection.remove(trackIds)
				}));
        }
    ];
	return thing;
}

function getCollectionMenuItem(trackIds: number[], collection: Collection): MenuEntry {
	const childrenCollectionMenus: MenuEntry[] = Array.from(collection.getChildren())
		.sort(compareStack([
			new CompareEntry(collection => collection.name, compareUndefinedLast(compareSmartAlpha))
		]))
		.map(collection => getCollectionMenuItem(trackIds, collection));

    return {
        kind: "item",
        text: collection.name,
        submenu: {
            menuitems: [
                {
                    kind: "item",
                    text: "Add here",
                    click: () => {
                        collection.add(trackIds);
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
                        createCollection(collection).then(collection => {
                            if (collection === null) return;
                            collection.add(trackIds);
                        });
                    }
                }
            ]
        }
    }
}

function tracksPlay(trackIds: number[]) {
    Playlist.add(...trackIds);
    Playlist.changeTrack(Playlist.getNumTracks() - trackIds.length);
    Player.play();
}

function tracksPlayNext(trackIds: number[]) {
    Playlist.insertNext(...trackIds);
}

function tracksAddToPlaylist(trackIds: number[]) {
	if (Playlist.getNumTracks() == 0) {
		Playlist.add(...trackIds);
		Playlist.changeTrack(0);
	} else {
		Playlist.add(...trackIds);
	}
}