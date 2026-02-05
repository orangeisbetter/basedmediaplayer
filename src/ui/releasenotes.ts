import release_notes from "../../release_notes.json" with { type: "json" };

export const NAME = "Based Media Player";
export const VERSION = "0.1.0";

export function showReleaseNotesDialog() {
    const features: string[] = release_notes[VERSION].features;
    const changes: string[] = release_notes[VERSION].changes;
    const bugFixes: string[] = release_notes[VERSION].bug_fixes;

    const dialog: HTMLDialogElement = document.querySelector("#release_notes_dialog")!;
    console.log(dialog);

    const button: HTMLButtonElement = dialog.querySelector("button")!;
    button.addEventListener("click", () => dialog.close(), { once: true });

    const name: HTMLSpanElement = dialog.querySelector("#name")!;
    name.innerText = NAME;

    const version: HTMLSpanElement = dialog.querySelector("#version")!;
    version.innerText = VERSION;

    const featuresList: HTMLUListElement = dialog.querySelector("#features")!;
    featuresList.innerHTML = "";
    for (const feature of features) {
        const featureElement = document.createElement("li");
        featureElement.innerText = feature;
        featuresList.appendChild(featureElement);
    }

    const changesList: HTMLUListElement = dialog.querySelector("#changes")!;
    changesList.innerHTML = "";
    for (const change of changes) {
        const changeElement = document.createElement("li");
        changeElement.innerText = change;
        changesList.appendChild(changeElement);
    }

    const bugFixesList: HTMLUListElement = dialog.querySelector("#bug_fixes")!;
    bugFixesList.innerHTML = "";
    for (const bugFix of bugFixes) {
        const bugFixElement = document.createElement("li");
        bugFixElement.innerText = bugFix;
        bugFixesList.appendChild(bugFixElement);
    }

    dialog.showModal();
}