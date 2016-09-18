/// <reference path="../../../typings/globals/jquery/index.d.ts" />
define(["require", "exports"], function (require, exports) {
    "use strict";
    var language;
    var i8lnDictionary = {};
    var languageLookups = 0;
    var languageLookupThreshold = 3;
    function setLanguage(lang) {
        language = lang;
    }
    exports.setLanguage = setLanguage;
    function i8ln(word) {
        if ($.isEmptyObject(i8lnDictionary) && language !== 'en' && languageLookups < languageLookupThreshold) {
            $.ajax({
                url: 'static/dist/locales/' + language + '.min.json',
                dataType: 'json',
                async: false,
                success: function (data) {
                    i8lnDictionary = data;
                },
                error: function (jqXHR, status, error) {
                    console.log('Error loading i8ln dictionary: ' + error);
                    languageLookups++;
                }
            });
        }
        if (word in i8lnDictionary) {
            return i8lnDictionary[word];
        }
        else {
            // Word doesn't exist in dictionary return it as is
            return word;
        }
    }
    exports.i8ln = i8ln;
});
//# sourceMappingURL=strings.js.map