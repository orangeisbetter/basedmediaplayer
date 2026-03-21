import { Collection } from "../collection.ts";

export function createCollection(parent: Collection | null): Promise<Collection | null> {
    return new Promise(resolve => {
        const dialog = document.querySelector<HTMLDialogElement>("#create-collection-dialog")!;
        const form = dialog.querySelector("form")!;

        let submitted = false;

        const submit = () => {
            submitted = true;
            const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
            if (parent === null) {
                resolve(Collection.createRootCollection(name));
            } else {
                resolve(parent.createChild(name));
            }
        }

        form.addEventListener("submit", submit, { once: true });

        dialog.addEventListener("close", () => {
            if (submitted) return;
            form.removeEventListener("submit", submit);
            resolve(null);
        })

        dialog.showModal();
    });
}