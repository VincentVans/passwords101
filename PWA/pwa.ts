/// <reference path="../sjcl.d.ts" />
/// <reference path="../core.ts" />

class PwaStorage implements Passwords101Storage {
    private storageKey: string = "passwords101.storage";

    private loadAllRaw(): { [input: string]: PasswordEntrySettings } {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) {
                return {};
            }
            const parsed = JSON.parse(raw);
            if (typeof parsed !== "object" || parsed === null) {
                return {};
            }
            return parsed;
        } catch (e) {
            return {};
        }
    }

    private saveAllRaw(all: { [input: string]: PasswordEntrySettings }): void {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(all));
        } catch (e) {
            // ignore quota errors etc.
        }
    }

    getAll(): Promise<{ [input: string]: PasswordEntrySettings }> {
        return Promise.resolve(this.loadAllRaw());
    }

    getForInput(input: string): Promise<{ [input: string]: PasswordEntrySettings }> {
        const all = this.loadAllRaw();
        if (Object.prototype.hasOwnProperty.call(all, input)) {
            const result: any = {};
            result[input] = all[input];
            return Promise.resolve(result);
        }
        return Promise.resolve({});
    }

    save(input: string, specialChar: string, maxLength: number): Promise<void> {
        const all = this.loadAllRaw();
        if (!all[input]) {
            all[input] = { specialChar: "" };
        }
        all[input].specialChar = specialChar;
        if (maxLength > 0) {
            all[input].maxLength = maxLength;
        } else {
            delete all[input].maxLength;
        }
        this.saveAllRaw(all);
        return Promise.resolve();
    }
}

function pwaGetInitialUrl(): Promise<string | null> {
    try {
        return Promise.resolve(window.location.href);
    } catch (e) {
        return Promise.resolve(null);
    }
}

function pwaOnError(error: any) {
    console.log("Passwords101 PWA error:", error);
}

// Register service worker for PWA if supported
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(pwaOnError);
}

// Initialize shared core with PWA-specific environment
initPasswords101({
    storage: new PwaStorage(),
    getInitialUrl: pwaGetInitialUrl,
    onError: pwaOnError
});


