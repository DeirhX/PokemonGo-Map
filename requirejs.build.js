({
    appDir: "static/dist/js",
    baseUrl: ".",
    dir: "static/dist/rs",
    optimize: 'uglify',
    modules:[
    {
        name:'main'
    }
    ],
    logLevel: 0,
    findNestedDependencies: true,
    fileExclusionRegExp: /^\./,
    inlineText: true
})