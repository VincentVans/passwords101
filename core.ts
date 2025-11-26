/*
 Shared core logic for Passwords 101.
 Depends on global `sjcl` and fixed element IDs in the DOM.
*/

/// <reference path="./sjcl.d.ts" />

interface Passwords101Storage {
    getAll(): Promise<{ [input: string]: { specialChar: string } }>;
    getForInput(input: string): Promise<{ [input: string]: { specialChar: string } }>;
    save(input: string, specialChar: string): Promise<void>;
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
const specialCharCheckboxID = "passwordGeneratorSpecialCharacterCheckBox";
const specialCharID = "passwordGeneratorSpecialCharacterInput";
const specialCharRowID = "passwordGeneratorSpecialCharacterInputRow";
const dataListID = "passwordGeneratorDataList";
const referenceCodeID = "passwordGeneratorReferenceCode";
const specialCharKey = "specialChar";

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
    let specialChar = specialCharChecked() ? getInput(specialCharID) : "";
    storeInput(input, specialChar);
    let masterPassword = getInput(masterPasswordID);
    showBusy();
    setTimeout(() => showPassword(hash(input, masterPassword) + specialChar), 50);
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
    if (specialCharChecked()) {
        input!.removeAttribute("disabled");
        row!.style.display = "table-row";
    }
    else {
        input!.setAttribute("disabled", "disabled");
        row!.style.display = "none";
    }
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

function storeInput(input: string, specialChar: string) {
    if (!input) {
        return;
    }
    // Shape is kept for backwards compatibility with existing storage
    let all = getEnv().storage;
    // Delegate persistence to environment implementation
    all.save(input, specialChar).catch(passwords101HandleError);
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
        let specialChars = (<any>obj)[keys[0]];
        if (!specialChars || specialChars[specialCharKey].length == 0) {
            clearSpecialCharSettings();
        }
        else {
            (<HTMLInputElement>document.getElementById(specialCharID)).value = specialChars[specialCharKey];
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
}


