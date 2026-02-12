interface ReleaseNotes {
    version: string,
    features?: string[],
    changes?: string[],
    bug_fixes?: string[]
};

function versionCompare(a: ReleaseNotes, b: ReleaseNotes) {
    const partsA = a.version.split('.').map(Number);
    const partsB = b.version.split('.').map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;

        if (numA !== numB) {
            return numA - numB;
        }
    }

    return 0;
}

const releaseNotesPromise = fetch("./release_notes.json")
    .then(response => response.json() as Promise<ReleaseNotes[]>)
    .then(notes => notes.sort((a, b) => versionCompare(b, a)));

export const NAME = "Based Media Player";

export function getVersion(): Promise<string> {
    return releaseNotesPromise.then(releaseNotes => releaseNotes[0].version);
}

function releaseNotesEntry(versionNotes: ReleaseNotes) {
    const entry = document.createElement("div");
    entry.className = "release-notes-entry";

    const heading = document.createElement("h3");
    heading.textContent = `Version ${versionNotes.version}`;

    entry.appendChild(heading);

    if (versionNotes.features && versionNotes.features.length > 0) {
        const featuresHeading = document.createElement("h4");
        featuresHeading.textContent = "New Features";

        entry.appendChild(featuresHeading);

        const featuresList = document.createElement("ul");
        featuresList.innerHTML = "";
        for (const feature of versionNotes.features) {
            const featureElement = document.createElement("li");
            featureElement.innerText = feature;
            featuresList.appendChild(featureElement);
        }

        entry.appendChild(featuresList);
    }

    if (versionNotes.changes && versionNotes.changes.length > 0) {
        const changesHeading = document.createElement("h4");
        changesHeading.textContent = "Changes";

        entry.appendChild(changesHeading);

        const changesList = document.createElement("ul");
        changesList.innerHTML = "";
        for (const change of versionNotes.changes) {
            const changeElement = document.createElement("li");
            changeElement.innerText = change;
            changesList.appendChild(changeElement);
        }

        entry.appendChild(changesList);
    }

    if (versionNotes.bug_fixes && versionNotes.bug_fixes.length > 0) {
        const bugFixesHeading = document.createElement("h4");
        bugFixesHeading.textContent = "Bug Fixes / Improvements";

        entry.appendChild(bugFixesHeading);

        const bugFixesList = document.createElement("ul");
        bugFixesList.innerHTML = "";
        for (const bugFix of versionNotes.bug_fixes) {
            const bugFixElement = document.createElement("li");
            bugFixElement.innerText = bugFix;
            bugFixesList.appendChild(bugFixElement);
        }

        entry.appendChild(bugFixesList);
    }

    return entry;
}

export async function showReleaseNotesDialog() {
    const dialog: HTMLDialogElement = document.querySelector("#release_notes_dialog")!;

    const button: HTMLButtonElement = dialog.querySelector("button")!;
    button.addEventListener("click", () => dialog.close(), { once: true });

    const notes: HTMLDivElement = dialog.querySelector("#notes")!;
    notes.innerHTML = "";

    for (const version of await releaseNotesPromise) {
        const entry = releaseNotesEntry(version);
        notes.appendChild(entry);
    }

    const content = dialog.querySelector(".content")!;
    content.scrollTo({ top: 0, behavior: "instant" });

    dialog.showModal();
}