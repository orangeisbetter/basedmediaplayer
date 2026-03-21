import { Menu, MenuSystem } from "./menu.ts";
import { showReleaseNotesDialog } from "./releasenotes.ts";

declare const playver: HTMLDialogElement;

export class MenuBar {
    private static rootElement: HTMLDivElement;

    private static optionsButton: HTMLButtonElement;
    private static toolsButton: HTMLButtonElement;
    private static helpButton: HTMLButtonElement;

    private static menu: Menu = {
        menuitems: [
            {
                kind: "item",
                text: "Options",
                submenu: {
                    menuitems: [
                        {
                            kind: "item",
                            text: "Rescan library"
                        },
                        {
                            kind: "item",
                            text: "Manage collections"
                        }
                        // { kind: "separator" },
                        // {
                        //     kind: "item",
                        //     text: "Preferences"
                        // },
                    ]
                }
            },
            // {
            //     kind: "item",
            //     text: "Tools",
            //     submenu: {
            //         menuitems: [
            //             {
            //                 kind: "item",
            //                 text: "Cassette Recorder"
            //             }
            //         ]
            //     }
            // },
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