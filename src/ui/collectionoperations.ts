import { Collection } from "../data/collection.ts";
import { CollectionRepository } from "../data/collectionstore.ts";

export function createCollectionDialog(parent: Collection | null): Promise<Collection | null> {
    return new Promise(resolve => {
        const dialog = document.querySelector<HTMLDialogElement>("#create-collection-dialog")!;
        const form = dialog.querySelector("form")!;
		const nameInput = form.elements.namedItem("name") as HTMLInputElement;

		nameInput.value = "";

        let submitted = false;

        const submit = () => {
            submitted = true;
            const name = nameInput.value.trim();
            if (parent === null) {
                resolve(CollectionRepository.createNew(name, null));
            } else {
                resolve(CollectionRepository.createNew(name, parent));
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

export function renameCollectionDialog(collection: Collection): Promise<void> {
    return new Promise(resolve => {
        const dialog = document.querySelector<HTMLDialogElement>("#rename-collection-dialog")!;
        const form = dialog.querySelector("form")!;
		const nameInput = form.elements.namedItem("name") as HTMLInputElement;

		nameInput.value = collection.getName();

        let submitted = false;

        const submit = () => {
            submitted = true;
            const name = nameInput.value.trim();
			collection.setName(name);
			resolve();
        }

        form.addEventListener("submit", submit, { once: true });

        dialog.addEventListener("close", () => {
            if (submitted) return;
            form.removeEventListener("submit", submit);
            resolve();
        })

        dialog.showModal();
    });
}