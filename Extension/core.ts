/*
Extension-specific bootstrap for Passwords 101.
Delegates all core behavior to the shared root-level `core.ts`.
*/

/// <reference path="../sjcl.d.ts" />
/// <reference path="../core.ts" />

declare var browser: any;
declare var chrome: any;

var chromeDefined = typeof chrome !== "undefined";
var browserDefined = typeof browser !== "undefined";

function extensionOnError(error: Error) {
    console.log("Error: " + error);
}

class ExtensionStorage implements Passwords101Storage {
    getAll(): Promise<{ [input: string]: PasswordEntrySettings }> {
        return new Promise((resolve, reject) => {
            if (chromeDefined && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get(null, (obj: any) => resolve(obj || {}));
            }
            else if (browserDefined && browser.storage && browser.storage.sync) {
                let promise = browser.storage.sync.get();
                promise.then((obj: any) => resolve(obj || {}), reject);
            }
            else {
                resolve({});
            }
        });
    }

    getForInput(input: string): Promise<{ [input: string]: PasswordEntrySettings }> {
        return new Promise((resolve, reject) => {
            if (chromeDefined && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get(input, (obj: any) => resolve(obj || {}));
            }
            else if (browserDefined && browser.storage && browser.storage.sync) {
                let promise = browser.storage.sync.get(input);
                promise.then((obj: any) => resolve(obj || {}), reject);
            }
            else {
                resolve({});
            }
        });
    }

    save(input: string, specialChar: string, maxLength: number): Promise<void> {
        return new Promise((resolve, reject) => {
            let obj: any = {};
            let value: any = {};
            value["specialChar"] = specialChar;
            if (maxLength > 0) {
                value["maxLength"] = maxLength;
            }
            obj[input] = value;
            if (chromeDefined && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set(obj, () => resolve());
            }
            else if (browserDefined && browser.storage && browser.storage.sync) {
                let promise = browser.storage.sync.set(obj);
                promise.then(() => resolve(), reject);
            }
            else {
                resolve();
            }
        });
    }
}

function getInitialUrlFromTabs(): Promise<string | null> {
    return new Promise((resolve, reject) => {
        if (chromeDefined && chrome.tabs) {
            let query = { active: true, currentWindow: true };
            chrome.tabs.query(query, (tabs: any[]) => {
                if (tabs && tabs.length > 0) {
                    resolve(tabs[0].url);
                } else {
                    resolve(null);
                }
            });
        }
        else if (browserDefined && browser.tabs) {
            let promise = browser.tabs.query({ active: true, currentWindow: true });
            promise.then(
                (tabs: any[]) => resolve(tabs && tabs.length > 0 ? tabs[0].url : null),
                reject
            );
        }
        else {
            resolve(null);
        }
    });
}

// Initialize shared core with extension-specific environment
initPasswords101({
    storage: new ExtensionStorage(),
    getInitialUrl: getInitialUrlFromTabs,
    onError: extensionOnError
});