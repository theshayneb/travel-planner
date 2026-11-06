import { App, Modal, Setting } from "obsidian";

export function confirm(app: App, title: string, message: string, action: string): Promise<boolean> {
	return new Promise(resolve => {
		let answered = false;
		const modal = new (class extends Modal {
			onOpen(): void {
				this.setTitle(title);
				this.contentEl.createEl("p", { text: message });
				new Setting(this.contentEl)
					.addButton(b => b.setButtonText(action).setClass("mod-warning").onClick(() => {
						answered = true;
						resolve(true);
						this.close();
					}))
					.addButton(b => b.setButtonText("Cancel").onClick(() => this.close()));
			}
			onClose(): void {
				this.contentEl.empty();
				if (!answered) resolve(false);
			}
		})(app);
		modal.open();
	});
}
