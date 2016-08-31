/// <reference path="../../../typings/globals/jquery/index.d.ts" />

let language;
let i8lnDictionary = {}
let languageLookups = 0
let languageLookupThreshold = 3

export function setLanguage(lang: string) {
    language = lang;
}

export function i8ln (word) {
    if ($.isEmptyObject(i8lnDictionary) && language !== 'en' && languageLookups < languageLookupThreshold) {
        $.ajax({
            url: 'static/dist/locales/' + language + '.min.json',
            dataType: 'json',
            async: false,
            success: function (data) {
                i8lnDictionary = data
            },
            error: function (jqXHR, status, error) {
                console.log('Error loading i8ln dictionary: ' + error)
                languageLookups++
            }
        })
    }
    if (word in i8lnDictionary) {
        return i8lnDictionary[word];
    } else {
        // Word doesn't exist in dictionary return it as is
        return word;
    }
}
