import { Collection } from "../collection.ts";
import { Player } from "../player.ts";
import { Playlist } from "../playlist.ts";
import { createCollection } from "./createcollection.ts";
import { MenuEntry } from "./menu.ts";

export function getTracksMenuItems(trackIds: number[]): MenuEntry {
    return [
        {
            kind: "item",
            text: "Play",
            click: () => tracksPlay(trackIds)
        },
        {
            kind: "item",
            text: "Play next",
            click: () => tracksPlayNext(trackIds)
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
                        if (Collection.rootCollections.length == 0) return null;
                        return [
                            Collection.rootCollections.map(collId => getCollectionMenuItem(trackIds, Collection.byID(collId)!)),
                            { kind: "separator" },
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
            return Array.from(collections).map(collection => ({
                kind: "item",
                text: `Remove from collection '${collection.name}'`,
                click: () => collection.remove(trackIds)
            }));
        }
    ]
}

function getCollectionMenuItem(trackIds: number[], collection: Collection): MenuEntry {
    const childrenCollectionMenus: MenuEntry[] = [];
    for (const child of collection.getChildren()) {
        childrenCollectionMenus.push(getCollectionMenuItem(trackIds, child));
    }
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
                () => {
                    if (childrenCollectionMenus.length === 0) return null;
                    return [
                        { kind: "separator" },
                        ...childrenCollectionMenus
                    ]
                },
                { kind: "separator" },
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
    Playlist.add(...trackIds);
}