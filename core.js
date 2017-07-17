/*
Copyright (c) 2017, Kasper van Schie. All rights reserved.

Redistribution and use in source and binary forms, without
modification, are permitted provided that the following conditions are
met:

    1. Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.

    2. Redistributions in binary form must reproduce the above copyright
notice, this list of conditions and the following disclaimer in the
documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
/// <reference path="./sjcl.d.ts" />
var urlInputID = "passwordGeneratorInput";
var masterPasswordID = "passwordGeneratorMasterPassword";
var generateID = "passwordGeneratorGenerate";
var generatedPasswordID = "passwordGeneratorGeneratedPassword";
var copyPasswordID = "passwordGeneratorCopyPassword";
var specialCharCheckboxID = "passwordGeneratorSpecialCharacterCheckBox";
var specialCharID = "passwordGeneratorSpecialCharacterInput";
var specialCharRowID = "passwordGeneratorSpecialCharacterInputRow";
var dataListID = "passwordGeneratorDataList";
var referenceCodeID = "passwordGeneratorReferenceCode";
var specialCharKey = "specialChar";
document.addEventListener('DOMContentLoaded', function () {
    //Hook up events
    document.getElementById(generateID).addEventListener('click', generatePassword);
    document.getElementById(copyPasswordID).addEventListener('click', copyToClipboard);
    document.getElementById(specialCharCheckboxID).addEventListener('click', toggleSpecialChar);
    document.getElementById(urlInputID).addEventListener('change', updateSpecialCharIfKnownInput);
    document.getElementById(urlInputID).addEventListener('keyup', updateSpecialCharIfKnownInput);
    document.getElementById(masterPasswordID).addEventListener('keyup', updateReferenceCode);
    document.getElementById(masterPasswordID).addEventListener('change', updateReferenceCode);
});
var chromeDefined = typeof chrome !== "undefined";
var browserDefined = typeof browser !== "undefined";
if (chromeDefined && chrome.tabs) {
    var query = { active: true, currentWindow: true };
    chrome.tabs.query(query, function (tabs) { return setInput(tabs[0].url); });
    chrome.storage.sync.get(null, populateSuggestions);
}
else if (browserDefined && browser.tabs) {
    var promise = browser.tabs.query({ active: true, currentWindow: true });
    promise.then(function (tabs) { return setInput(tabs[0].url); }, onError);
    var promise2 = browser.storage.sync.get();
    promise2.then(populateSuggestions, onError);
}
function onError(error) {
    console.log("Error: " + error);
}
function generatePassword() {
    var input = getInput(urlInputID);
    var specialChar = specialCharChecked() ? getInput(specialCharID) : "";
    storeInput(input, specialChar);
    var masterPassword = getInput(masterPasswordID);
    showBusy();
    setTimeout(function () { return showPassword(hash(input, masterPassword) + specialChar); }, 50);
}
function getInput(id) {
    return document.getElementById(id).value;
}
function showBusy() {
    var resultElem = getResultElement();
    resultElem.value = "Generating...";
}
function showPassword(password) {
    getResultElement().value = password;
    var copy = document.getElementById(copyPasswordID);
    copy.removeAttribute("disabled");
}
function getResultElement() {
    return document.getElementById(generatedPasswordID);
}
function hash(input, masterPassword) {
    var pass = sjcl.codec.utf8String.toBits(masterPassword);
    var inp = sjcl.codec.utf8String.toBits(input.toLowerCase());
    return bitsToPassword(sjcl.misc.pbkdf2(masterPassword, sjcl.misc.pbkdf2(pass, inp, 1, 256), 50000, 96));
}
function bitsToPassword(bits) {
    return sjcl.codec.base64.fromBits(bits).replace(/\+/g, "K").replace(/\//g, "S");
}
function copyToClipboard() {
    getResultElement().select();
    document.execCommand("Copy");
}
function specialCharChecked() {
    return document.getElementById(specialCharCheckboxID).checked;
}
function toggleSpecialChar() {
    var input = document.getElementById(specialCharID);
    var row = document.getElementById(specialCharRowID);
    if (specialCharChecked()) {
        input.removeAttribute("disabled");
        row.style.display = "table-row";
    }
    else {
        input.setAttribute("disabled", "disabled");
        row.style.display = "none";
    }
}
function setInput(url) {
    var input = document.getElementById(urlInputID);
    var start = url.indexOf("://") + 3;
    var domain = url.substring(start, url.indexOf("/", start));
    input.value = domain.substring(domain.lastIndexOf(".", domain.lastIndexOf(".") - 1) + 1).toLowerCase();
    updateSpecialCharIfKnownInput();
}
function createSuggestion(value) {
    var option = document.createElement("option");
    option.value = value;
    return option;
}
function populateSuggestions(obj) {
    var list = document.getElementById(dataListID);
    var keys = Object.keys(obj);
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        list.appendChild(createSuggestion(key));
    }
}
function storeInput(input, specialChar) {
    var obj = {};
    var value = {};
    value[specialCharKey] = specialChar;
    obj[input] = value;
    if (chromeDefined && chrome.storage) {
        chrome.storage.sync.set(obj);
    }
    else if (browserDefined && browser.storage) {
        browser.storage.sync.set(obj);
    }
}
function updateSpecialCharIfKnownInput() {
    if (chromeDefined && chrome.storage) {
        chrome.storage.sync.get(getInput(urlInputID), updateSpecialChar);
    }
    else if (browserDefined && browser.storage) {
        var promise = browser.storage.sync.get(getInput(urlInputID));
        promise.then(updateSpecialChar, onError);
    }
}
var referenceCodeTimer = setTimeout(updateReferenceCodeImpl, 0);
function updateReferenceCode() {
    clearTimeout(referenceCodeTimer);
    referenceCodeTimer = setTimeout(updateReferenceCodeImpl, 500);
}
function updateReferenceCodeImpl() {
    var masterPassword = getInput(masterPasswordID);
    if (masterPassword.length === 0) {
        document.getElementById(referenceCodeID).textContent = "-no password yet-";
        return;
    }
    var pass = sjcl.codec.utf8String.toBits(masterPassword);
    var inp = sjcl.codec.utf8String.toBits("referenceCode");
    var referenceCode = bitsToPassword(sjcl.misc.pbkdf2(masterPassword, sjcl.misc.pbkdf2(pass, inp, 1, 256), 10, 12));
    document.getElementById(referenceCodeID).textContent = referenceCode.replace(/\=/g, "");
}
function updateSpecialChar(obj) {
    var keys = Object.keys(obj);
    if (keys.length != 0) {
        var specialChars = obj[keys[0]];
        if (specialChars[specialCharKey].length == 0) {
            clearSpecialCharSettings();
        }
        else {
            document.getElementById(specialCharID).value = specialChars[specialCharKey];
            if (!specialCharChecked()) {
                document.getElementById(specialCharCheckboxID).click();
            }
        }
    }
    else {
        clearSpecialCharSettings();
    }
}
function clearSpecialCharSettings() {
    if (specialCharChecked()) {
        document.getElementById(specialCharCheckboxID).click();
    }
    document.getElementById(specialCharID).value = "!";
}
//# sourceMappingURL=core.js.map