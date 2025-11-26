/*
 Shared core logic for Passwords 101.
 Depends on global `sjcl` and fixed element IDs in the DOM.
*/

/// <reference path="./sjcl.d.ts" />

interface PasswordEntrySettings {
    specialChar?: string;
    maxLength?: number;
}

interface Passwords101Storage {
    getAll(): Promise<{ [input: string]: PasswordEntrySettings }>;
    getForInput(input: string): Promise<{ [input: string]: PasswordEntrySettings }>;
    save(input: string, specialChar: string, maxLength: number): Promise<void>;
}

interface Passwords101Environment {
    storage: Passwords101Storage;
    /** URL of the active page / current site, or null if not available. */
    getInitialUrl(): Promise<string | null>;
    /** Optional error callback. */
    onError?(error: any): void;
}

const urlInputID = "passwordGeneratorInput";
const masterPasswordID = "passwordGeneratorMasterPassword";
const generateID = "passwordGeneratorGenerate";
const generatedPasswordID = "passwordGeneratorGeneratedPassword";
const copyPasswordID = "passwordGeneratorCopyPassword";
const exportButtonID = "passwordGeneratorExport";
const importButtonID = "passwordGeneratorImport";
const specialCharCheckboxID = "passwordGeneratorSpecialCharacterCheckBox";
const specialCharID = "passwordGeneratorSpecialCharacterInput";
const specialCharRowID = "passwordGeneratorSpecialCharacterInputRow";
const maxLengthID = "passwordGeneratorMaxLengthInput";
const maxLengthRowID = "passwordGeneratorMaxLengthInputRow";
const dataListID = "passwordGeneratorDataList";
const referenceCodeID = "passwordGeneratorReferenceCode";
const specialCharKey = "specialChar";
const maxLengthKey = "maxLength";
const ignoreMaxLength = -1;

let passwords101Env: Passwords101Environment | null = null;

function passwords101HandleError(error: any) {
    if (passwords101Env && passwords101Env.onError) {
        passwords101Env.onError(error);
    } else {
        // Fallback logging
        // eslint-disable-next-line no-console
        console.log("Passwords101 error:", error);
    }
}

function getEnv(): Passwords101Environment {
    if (!passwords101Env) {
        throw new Error("Passwords101 environment not initialized. Call initPasswords101 first.");
    }
    return passwords101Env;
}

/**
 * Initialize the shared Passwords 101 behavior.
 * Call this once from each host (extension popup, PWA, etc.) with its own environment.
 */
function initPasswords101(env: Passwords101Environment) {
    passwords101Env = env;

    document.addEventListener('DOMContentLoaded', function () {
        // Hook up events
        document.getElementById(generateID)!.addEventListener('click', generatePassword);
        document.getElementById(copyPasswordID)!.addEventListener('click', copyToClipboard);
        const exportBtn = document.getElementById(exportButtonID);
        if (exportBtn) {
            exportBtn.addEventListener('click', exportStorage);
        }
        const importBtn = document.getElementById(importButtonID);
        if (importBtn) {
            importBtn.addEventListener('click', importStorage);
        }
        document.getElementById(specialCharCheckboxID)!.addEventListener('click', toggleSpecialChar);
        document.getElementById(urlInputID)!.addEventListener('change', updateSpecialCharIfKnownInput);
        document.getElementById(urlInputID)!.addEventListener('keyup', updateSpecialCharIfKnownInput);
        document.getElementById(masterPasswordID)!.addEventListener('keyup', updateReferenceCode);
        document.getElementById(masterPasswordID)!.addEventListener('change', updateReferenceCode);

        // Environment-specific initialization
        env.getInitialUrl()
            .then(url => {
                if (url) {
                    setInput(url);
                }
            })
            .catch(passwords101HandleError);

        env.storage.getAll()
            .then(populateSuggestions)
            .catch(passwords101HandleError);

        // Initialize reference code text
        updateReferenceCodeImpl();
    });
}

function generatePassword() {
    let input = getInput(urlInputID);
    let masterPassword = getInput(masterPasswordID);

    let specialChar: string;
    let maxLength: number;

    if (specialCharChecked()) {
        specialChar = getInput(specialCharID);
        maxLength = getMaxLengthFromInput();
    } else {
        specialChar = "";
        maxLength = ignoreMaxLength;
    }

    storeInput(input, specialChar, maxLength);

    showBusy();
    setTimeout(() => {
        const password = generatePasswordValue(input, masterPassword, specialChar, maxLength);
        showPassword(password);
    }, 50);
}

function getInput(id: string): string {
    return (<HTMLInputElement>document.getElementById(id)).value;
}

function showBusy() {
    let resultElem = getResultElement();
    resultElem.value = "Generating...";
}

function showPassword(password: string) {
    getResultElement().value = password;
    let copy = document.getElementById(copyPasswordID);
    copy!.removeAttribute("disabled");
}

function getResultElement() {
    return <HTMLInputElement>document.getElementById(generatedPasswordID);
}

function hash(input: string, masterPassword: string) {
    let pass = sjcl.codec.utf8String.toBits(masterPassword);
    let inp = sjcl.codec.utf8String.toBits(input.toLowerCase());
    return bitsToPassword(sjcl.misc.pbkdf2(masterPassword, sjcl.misc.pbkdf2(pass, inp, 1, 256), 50000, 96));
}

function bitsToPassword(bits: sjcl.BitArray) {
    return sjcl.codec.base64.fromBits(bits).replace(/\+/g, "K").replace(/\//g, "S");
}

function truncate(input: string, length: number): string {
    const safeLength = Math.max(0, length);
    if (safeLength === 0) {
        return "";
    }
    if (input.length <= safeLength) {
        return input;
    }
    return input.substring(0, safeLength);
}

function generatePasswordValue(input: string, masterPassword: string, specialChar: string, maxLength: number): string {
    const base = hash(input, masterPassword);

    if (maxLength !== ignoreMaxLength) {
        const allowedCoreLength = maxLength - specialChar.length;
        const truncatedBase = truncate(base, allowedCoreLength);
        const combined = truncatedBase + specialChar;
        const finalValue = truncate(combined, maxLength);
        return finalValue;
    }

    return base + specialChar;
}

function copyToClipboard() {
    const elem = getResultElement();
    elem.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(elem.value).catch(() => {
            document.execCommand("copy");
        });
    } else {
        document.execCommand("copy");
    }
}

function specialCharChecked(): boolean {
    return (<HTMLInputElement>document.getElementById(specialCharCheckboxID)).checked;
}

function toggleSpecialChar() {
    let input = document.getElementById(specialCharID);
    let row = document.getElementById(specialCharRowID);
    let maxInput = document.getElementById(maxLengthID);
    let maxRow = document.getElementById(maxLengthRowID);
    if (specialCharChecked()) {
        input!.removeAttribute("disabled");
        row!.style.display = "";
        if (maxInput && maxRow) {
            maxInput.removeAttribute("disabled");
            maxRow.style.display = "";
        }
    }
    else {
        input!.setAttribute("disabled", "disabled");
        row!.style.display = "none";
        if (maxInput && maxRow) {
            maxInput.setAttribute("disabled", "disabled");
            maxRow.style.display = "none";
        }
    }
}

function getMaxLengthFromInput(): number {
    const raw = getInput(maxLengthID);
    if (!raw) {
        return ignoreMaxLength;
    }
    const parsed = parseInt(raw, 10);
    if (!isFinite(parsed) || parsed <= 0) {
        return ignoreMaxLength;
    }
    return parsed;
}

function setInput(url: string) {
    let input = <HTMLInputElement>document.getElementById(urlInputID);
    let start = url.indexOf("://") + 3;
    let domain = url.substring(start, url.indexOf("/", start));
    input.value = domain.substring(domain.lastIndexOf(".", domain.lastIndexOf(".") - 1) + 1).toLowerCase();
    updateSpecialCharIfKnownInput();
}

function createSuggestion(value: string) {
    let option = document.createElement("option");
    option.value = value;
    return option;
}

function populateSuggestions(obj: Object) {
    let list = document.getElementById(dataListID);
    let keys = Object.keys(obj);
    for (let key of keys) {
        list!.appendChild(createSuggestion(key));
    }
}

function storeInput(input: string, specialChar: string, maxLength: number) {
    if (!input) {
        return;
    }
    // Delegate persistence to environment implementation
    getEnv().storage.save(input, specialChar, maxLength).catch(passwords101HandleError);
}

function updateSpecialCharIfKnownInput() {
    const key = getInput(urlInputID);
    getEnv().storage.getForInput(key)
        .then(updateSpecialChar)
        .catch(passwords101HandleError);
}

var referenceCodeTimer = setTimeout(updateReferenceCodeImpl, 0);

function updateReferenceCode() {
    clearTimeout(referenceCodeTimer);
    referenceCodeTimer = setTimeout(updateReferenceCodeImpl, 500);
}

function updateReferenceCodeImpl() {
    let masterPassword = getInput(masterPasswordID);
    if (masterPassword.length === 0) {
        document.getElementById(referenceCodeID)!.textContent = "-no password yet-";
        return;
    }
    let pass = sjcl.codec.utf8String.toBits(masterPassword);
    let inp = sjcl.codec.utf8String.toBits("referenceCode");
    let referenceCode = bitsToPassword(sjcl.misc.pbkdf2(masterPassword, sjcl.misc.pbkdf2(pass, inp, 1, 256), 10, 12));
    document.getElementById(referenceCodeID)!.textContent = referenceCode.replace(/\=/g, "");
}

function updateSpecialChar(obj: Object) {
    let keys = Object.keys(obj);
    if (keys.length != 0) {
        let settings = (<any>obj)[keys[0]] as PasswordEntrySettings;
        const storedSpecial = settings && typeof settings[specialCharKey] === "string"
            ? (settings[specialCharKey] as string)
            : "";
        const storedMaxLength = settings && typeof settings[maxLengthKey] === "number"
            ? (settings[maxLengthKey] as number)
            : ignoreMaxLength;

        if (storedSpecial.length === 0 && storedMaxLength === ignoreMaxLength) {
            clearSpecialCharSettings();
        }
        else {
            (<HTMLInputElement>document.getElementById(specialCharID)).value = storedSpecial || "!";
            const maxInputElem = <HTMLInputElement>document.getElementById(maxLengthID);
            if (maxInputElem) {
                maxInputElem.value = storedMaxLength === ignoreMaxLength ? "" : storedMaxLength.toString();
            }
            if (!specialCharChecked()) {
                document.getElementById(specialCharCheckboxID)!.click();
            }
        }
    }
    else {
        clearSpecialCharSettings();
    }
}

function clearSpecialCharSettings() {
    if (specialCharChecked()) {
        document.getElementById(specialCharCheckboxID)!.click();
    }
    (<HTMLInputElement>document.getElementById(specialCharID)).value = "!";
    const maxInputElem = <HTMLInputElement>document.getElementById(maxLengthID);
    if (maxInputElem) {
        maxInputElem.value = "";
    }
}

function exportStorage() {
    getEnv().storage.getAll()
        .then(all => {
            try {
                const text = JSON.stringify(all);
                // Simple, cross-environment way to let user copy the data
                window.prompt("Copy this text to back up your settings:", text);
            } catch (e) {
                passwords101HandleError(e);
            }
        })
        .catch(passwords101HandleError);
}

function importStorage() {
    const text = window.prompt("Paste previously exported settings here:", "");
    if (!text) {
        return;
    }
    let parsed: any;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        try {
            parsed = legacyImportParser(text);
        }
        catch (e) {
            passwords101HandleError(e);
            return;
        }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        // Not in the expected format
        return;
    }

    const entries: { [input: string]: PasswordEntrySettings } = parsed;
    const keys = Object.keys(entries);
    const savePromises: Promise<void>[] = [];

    for (const key of keys) {
        const entry = entries[key] || {};
        const special = typeof entry.specialChar === "string" ? entry.specialChar : "";
        const maxLen = typeof entry.maxLength === "number" ? entry.maxLength : ignoreMaxLength;
        savePromises.push(getEnv().storage.save(key, special, maxLen));
    }

    Promise.all(savePromises)
        .then(() => getEnv().storage.getAll())
        .then(populateSuggestions)
        .then(() => updateSpecialCharIfKnownInput())
        .catch(passwords101HandleError);
}

/* input\specialchar\maxlength\
So google.com with ! and maxLength 5, wikipedia.com with no special char or maxLength would be
google.com\!\5\wikipedia.com\\-1\
*/
function legacyImportParser(text: string) {
    const values = text.split("\\");
    const entries: { [input: string]: PasswordEntrySettings } = {};
    for (let i = 0; i < values.length; i += 3) {
        const input = values[i];
        const specialChar = values[i + 1];
        const maxLength = values[i + 2];
        entries[input] = { specialChar: specialChar, maxLength: parseInt(maxLength, 10) };
    }
    return entries;
}