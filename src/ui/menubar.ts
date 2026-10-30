import { Library } from "../library.ts";
import { CassetteRecorderView } from "./cassetterecorderview.ts";
import { Menu, MenuSystem } from "./menu.ts";
import { MusicBrowserView } from "./musicbrowserview.ts";
import { RadioStationsEditor } from "./radiostationsview.ts";
import { showReleaseNotesDialog } from "./releasenotes.ts";
import { StylesEditor } from "./styleseditor.ts";

declare const playver: HTMLDialogElement;

export class MenuBar {
    private static rootElement: HTMLDivElement;

    private static menu: Menu = {
        menuitems: [
            {
                kind: "item",
                text: "Options",
                submenu: {
                    menuitems: [
                        {
                            kind: "item",
                            text: "Change styling / theme",
							click: () => StylesEditor.openDialog()
                        },
						{
							kind: "item",
							text: "Manage radio stations",
							click: () => RadioStationsEditor.showDialog()
						},
						{
							kind: "item",
							text: "Rescan library",
							click: () => Library.scanLibrary().then(() => {
								MusicBrowserView.update()
							})
						}
                    ]
                }
            },
            {
                kind: "item",
                text: "Tools",
                submenu: {
                    menuitems: [
                        {
                            kind: "item",
                            text: "Cassette Recorder",
                            click: () => CassetteRecorderView.showDialog()
                        }
                    ]
                }
            },
            {
                kind: "item",
                text: "Help",
                submenu: {
                    menuitems: [
                        // {
                        //     kind: "item",
                        //     text: "View tutorial"
                        // },
                        {
                            kind: "item",
                            text: "Release notes",
                            click: () => showReleaseNotesDialog()
                        },
                        { kind: "separator" },
                        {
                            kind: "item",
                            text: "About",
                            click: () => playver.showModal()
                        },
                    ]
                }
            }
        ]
    };

    constructor() {
        throw Error("This static class cannot be instantiated");
    }

    static init(element: HTMLDivElement) {
        this.rootElement = element;

        MenuSystem.createMenuBar(this.rootElement, this.menu);
    }
}