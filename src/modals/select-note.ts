import { App, FuzzySuggestModal, TFile } from "obsidian";

/** Search the vault's Place/Event notes. */
export class SelectNoteModal extends FuzzySuggestModal<TFile> {
	constructor(app: App, private readonly notes: TFile[], private readonly onPick: (file: TFile) => void) {
		super(app);
		this.setPlaceholder("Find a place or event note…");
	}

	getItems(): TFile[] {
		return this.notes;
	}

	getItemText(file: TFile): string {
		return file.path.replace(/\.md$/, "");
	}

	onChooseItem(file: TFile): void {
		this.onPick(file);
	}
}
