//
// Global map.js variables
//
define(function (require) {
    var store = require('store');
    var mapStyles = require("map/styles").default;
    var search = require("map/overlay/search");
    var markers = require("map/overlay/markers");
    var notifications = require("notifications");
    var core = require("map/core");
    var entities = require("data/entities");

    var $selectExclude
    var $selectPokemonNotify
    var $selectRarityNotify
    var $selectStyle
    var $selectIconResolution
    var $selectIconSize
    var $selectLuredPokestopsOnly

    var language = document.documentElement.lang === '' ? 'en' : document.documentElement.lang
    var idToPokemon = {}
    var i8lnDictionary = {}
    var languageLookups = 0
    var languageLookupThreshold = 3

    var excludedPokemon = []

    var map
    var rawDataIsLoading = false
    var locationMarker


    var selectedStyle = 'light'

    var mapData = {
        pokemons: {},
        gyms: {},
        pokestops: {},
        lurePokemons: {},
        scanned: {},
        spawnpoints: {}
    }
    var pokemonSprites = {
        normal: {
            columns: 12,
            iconWidth: 30,
            iconHeight: 30,
            spriteWidth: 360,
            spriteHeight: 390,
            filename: 'static/icons-sprite.png',
            name: 'Normal'
        },
        highres: {
            columns: 7,
            iconWidth: 65,
            iconHeight: 65,
            spriteWidth: 455,
            spriteHeight: 1430,
            filename: 'static/icons-large-sprite.png',
            name: 'High-Res'
        },
        shuffle: {
            columns: 7,
            iconWidth: 65,
            iconHeight: 65,
            spriteWidth: 455,
            spriteHeight: 1430,
            filename: 'static/icons-shuffle-sprite.png',
            name: 'Shuffle'
        }
    }


    //
    // Functions
    //

    function excludePokemon (id) { // eslint-disable-line no-unused-vars
        $selectExclude.val(
            $selectExclude.val().concat(id)
        ).trigger('change')
    }

    function notifyAboutPokemon (id) { // eslint-disable-line no-unused-vars
        $selectPokemonNotify.val(
            $selectPokemonNotify.val().concat(id)
        ).trigger('change')
    }


    function initMap () { // eslint-disable-line no-unused-vars
        map = new google.maps.Map(document.getElementById('map'), {
            center: {
                lat: centerLat,
                lng: centerLng
            },
            zoom: 16,
            fullscreenControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
                position: google.maps.ControlPosition.RIGHT_TOP,
                mapTypeIds: [
                    google.maps.MapTypeId.ROADMAP,
                    google.maps.MapTypeId.SATELLITE,
                    'nolabels_style',
                    'dark_style',
                    'style_light2',
                    'style_pgo',
                    'dark_style_nl',
                    'style_light2_nl',
                    'style_pgo_nl'
                ]
            }
        })
        // TEMPORARY //
        core.map = map;
        core.google = google;

        mapStyles.initStyles();
        mapStyles.watchStyleChange();

        google.maps.event.addListener(map, 'idle', function () {
            if (history.pushState) {
                var newurl = window.location.protocol + "//" + window.location.host + window.location.pathname +
                    `?lat=${String(map.getCenter().lat()).substring(0, 8)}&lng=${String(map.getCenter().lng()).substring(0, 8)}`;
                window.history.pushState({path: newurl}, '', newurl);
            }
            updateMap();
        });

        search.createSearchMarker(map.getCenter().lat(), map.getCenter().lng())

        addMyLocationButton()
        initSidebar()
        google.maps.event.addListenerOnce(map, 'idle', function () {
            updateMap()
        })

        initPage()
        initPage2()

        google.maps.event.addListener(map, 'zoom_changed', function () {
            redrawPokemon(mapData.pokemons)
            redrawPokemon(mapData.lurePokemons)
        })
        deirhExtensions(map);
        var updateTimer = window.setInterval(updateMap, 5000, true);
        $(window).blur(function () {
            // window.clearInterval(updateTimer);
        });
        $(window).focus(function () {
            window.clearInterval(updateTimer);
            updateTimer = window.setInterval(updateMap, 5000, true);
        });

        return map;
    };

    var searchControlURI = 'search_control'

    function searchControl (action) {
        $.post(searchControlURI + '?action=' + encodeURIComponent(action))
    }

    function updateSearchStatus () {
        $.getJSON(searchControlURI).then(function (data) {
            $('#search-switch').prop('checked', data.status)
        })
    }

    function initSidebar () {
        $('#gyms-switch').prop('checked', store.Store.get('showGyms'))
        $('#pokemon-switch').prop('checked', store.Store.get('showPokemon'))
        $('#pokestops-switch').prop('checked', store.Store.get('showPokestops'))
        $('#lured-pokestops-only-switch').val(store.Store.get('showLuredPokestopsOnly'))
        $('#lured-pokestops-only-wrapper').toggle(store.Store.get('showPokestops'))
        $('#geoloc-switch').prop('checked', store.Store.get('geoLocate'))
        $('#lock-marker-switch').prop('checked', store.Store.get('lockMarker'))
        $('#start-at-user-location-switch').prop('checked', store.Store.get('startAtUserLocation'))
        $('#scanned-switch').prop('checked', store.Store.get('showScanned'))
        $('#spawnpoint-switch').prop('checked', store.Store.get('showSpawnpoints'))
        $('#sound-switch').prop('checked', store.Store.get('playSound'))
        var searchBox = new google.maps.places.SearchBox(document.getElementById('next-location'))
        $('#next-location').css('background-color', $('#geoloc-switch').prop('checked') ? '#e0e0e0' : '#ffffff')

        updateSearchStatus()
        setInterval(updateSearchStatus, 5000)

        searchBox.addListener('places_changed', function () {
            var places = searchBox.getPlaces()

            if (places.length === 0) {
                return
            }

            var loc = places[0].geometry.location
            changeLocation(loc.lat(), loc.lng())
        })

        var icons = $('#pokemon-icons')
        $.each(pokemonSprites, function (key, value) {
            icons.append($('<option></option>').attr('value', key).text(value.name))
        })
        icons.val((pokemonSprites[store.Store.get('pokemonIcons')]) ? store.Store.get('pokemonIcons') : 'highres')
        $('#pokemon-icon-size').val(store.Store.get('iconSizeModifier'))
    }

    function clearStaleMarkers () {
        $.each(mapData.pokemons, function (key, value) {
            if (mapData.pokemons[key]['disappear_time'] < new Date().getTime() ||
                excludedPokemon.indexOf(mapData.pokemons[key]['pokemon_id']) >= 0) {
                mapData.pokemons[key].marker.setMap(null)
                delete mapData.pokemons[key]
            }
        })

        $.each(mapData.lurePokemons, function (key, value) {
            if (mapData.lurePokemons[key]['lure_expiration'] < new Date().getTime() ||
                excludedPokemon.indexOf(mapData.lurePokemons[key]['pokemon_id']) >= 0) {
                mapData.lurePokemons[key].marker.setMap(null)
                delete mapData.lurePokemons[key]
            }
        })

        $.each(mapData.scanned, function (key, value) {
            // If older than 15mins remove
            if (mapData.scanned[key]['last_update'] < (new Date().getTime() - 15 * 60 * 1000)) {
                mapData.scanned[key].marker.setMap(null)
                delete mapData.scanned[key]
            } else {
                // Update color
                mapData.scanned[key].marker.setOptions({
                    fillColor: markers.getColorByDate(mapData.scanned[key]['last_update'])
                });
            }
        })
    }

    function showInBoundsMarkers (markers) {
        $.each(markers, function (key, value) {
            var marker = markers[key].marker
            var show = false
            if (!markers[key].hidden) {
                if (typeof marker.getBounds === 'function') {
                    if (map.getBounds().intersects(marker.getBounds())) {
                        show = true
                    }
                } else if (typeof marker.getPosition === 'function') {
                    if (map.getBounds().contains(marker.getPosition())) {
                        show = true
                    }
                }
            }

            if (show && !marker.getMap()) {
                marker.setMap(map)
                // Not all markers can be animated (ex: scan locations)
                if (marker.setAnimation && marker.oldAnimation) {
                    marker.setAnimation(marker.oldAnimation)
                }
            } else if (!show && marker.getMap()) {
                // Not all markers can be animated (ex: scan locations)
                if (marker.getAnimation) {
                    marker.oldAnimation = marker.getAnimation()
                }
                marker.setMap(null)
            }
        })
    }

    var lastReceivedObjects;

    function loadRawData (incremental) {
        var loadPokemon = store.Store.get('showPokemon');
        var loadGyms = store.Store.get('showGyms');
        var loadPokestops = store.Store.get('showPokestops');
        var loadScanned = store.Store.get('showScanned');
        var loadSpawnpoints = store.Store.get('showSpawnpoints')

        var bounds = map.getBounds()
        var swPoint = bounds.getSouthWest()
        var nePoint = bounds.getNorthEast()
        var swLat = swPoint.lat()
        var swLng = swPoint.lng()
        var neLat = nePoint.lat()
        var neLng = nePoint.lng()

        var incrementalTimestamps = incremental ? lastReceivedObjects : null;

        var response = $.ajax({
            url: 'raw_data',
            type: 'GET',
            data: {
                'pokemon': loadPokemon,
                'pokestops': loadPokestops,
                'gyms': loadGyms,
                'scanned': loadScanned,
                'spawnpoints': loadSpawnpoints,
                'swLat': swLat,
                'swLng': swLng,
                'neLat': neLat,
                'neLng': neLng,
                'key': 'dontspam',
                'lastTimestamps': incrementalTimestamps
            },
            dataType: 'json',
            cache: false,
            beforeSend: function () {
                if (rawDataIsLoading) {
                    return false
                } else {
                    rawDataIsLoading = true
                }
            },
            complete: function (data) {
                if (incremental && data.responseJSON) {
                    lastReceivedObjects = data.responseJSON.lastTimestamps;
                }
                rawDataIsLoading = false;
            }
        })

        return response;
    }

    function processPokemons (i, item) {
        if (!store.Store.get('showPokemon')) {
            return false // in case the checkbox was unchecked in the meantime.
        }

        if (!(item['encounter_id'] in mapData.pokemons) &&
            excludedPokemon.indexOf(item['pokemon_id']) < 0) {
            // add marker to map and item to dict
            if (item.marker) {
                item.marker.setMap(null)
            }
            if (!item.hidden) {
                item.marker = markers.setupPokemonMarker(item, pokemonSprites)
                mapData.pokemons[item['encounter_id']] = item
            }
        }
    }

    function processSpawns (i, item) {
        if (!store.Store.get('showSpawnpoints')) {
            return false; // in case the checkbox was unchecked in the meantime.
        }

        if (!(item.id in mapData.spawnpoints)) {
            // add marker to map and item to dict
            if (item.marker) item.marker.setMap(null);
            if (!item.hidden) {
                item.marker = markers.setupSpawnMarker(item, pokemonSprites);
                mapData.spawnpoints[item.id] = item;
            }
        }
    }


    function processPokestops (i, item) {
        if (!store.Store.get('showPokestops')) {
            return false
        }

        if (store.Store.get('showLuredPokestopsOnly') && !item['lure_expiration']) {
            if (mapData.pokestops[item['pokestop_id']] && mapData.pokestops[item['pokestop_id']].marker) {
                mapData.pokestops[item['pokestop_id']].marker.setMap(null)
                delete mapData.pokestops[item['pokestop_id']]
            }
            return true
        }

        if (!mapData.pokestops[item['pokestop_id']]) { // add marker to map and item to dict
            // add marker to map and item to dict
            if (item.marker) {
                item.marker.setMap(null)
            }
            item.marker = markers.setupPokestopMarker(item)
            mapData.pokestops[item['pokestop_id']] = item
        } else {
            var item2 = mapData.pokestops[item['pokestop_id']]
            if (!!item['lure_expiration'] !== !!item2['lure_expiration']) {
                item2.marker.setMap(null)
                item.marker = markers.setupPokestopMarker(item)
                mapData.pokestops[item['pokestop_id']] = item
            }
        }
    }

    function removePokemonMarker (encounterId) { // eslint-disable-line no-unused-vars
        mapData.pokemons[encounterId].marker.setMap(null)
        mapData.pokemons[encounterId].hidden = true
    }

    function processGyms (i, item) {
        if (!store.Store.get('showGyms')) {
            return false // in case the checkbox was unchecked in the meantime.
        }

        if (item['gym_id'] in mapData.gyms) {
            item.marker = markers.updateGymMarker(item, mapData.gyms[item['gym_id']].marker)
        } else { // add marker to map and item to dict
            item.marker = markers.setupGymMarker(item)
        }
        mapData.gyms[item['gym_id']] = item
    }

    function processScanned (i, item) {
        if (!store.Store.get('showScanned')) {
            return false
        }

        var scanId = item['latitude'] + '|' + item['longitude']

        if (scanId in mapData.scanned) {
            mapData.scanned[scanId].last_update = item['last_update']
            mapData.scanned[scanId].marker.setOptions({
                fillColor: markers.getColorByDate(item['last_update'])
            })
        } else { // add marker to map and item to dict
            if (item.marker) {
                item.marker.setMap(null)
            }
            item.marker = markers.setupScannedMarker(item)
            mapData.scanned[scanId] = item
        }
    }

    function updateMap (incremental) {
        loadRawData(incremental)
            .done(function (result) {
                $.each(result.pokemons, processPokemons)
                $.each(result.pokestops, processPokestops)
                $.each(result.gyms, processGyms)
                $.each(result.scanned, processScanned)
                $.each(result.spawns, processSpawns)
                showInBoundsMarkers(mapData.pokemons)
                showInBoundsMarkers(mapData.lurePokemons)
                showInBoundsMarkers(mapData.gyms)
                showInBoundsMarkers(mapData.pokestops)
                showInBoundsMarkers(mapData.scanned)
                showInBoundsMarkers(mapData.spawnpoints)
                clearStaleMarkers()
                if ($('#stats').hasClass('visible')) {
                    countMarkers()
                }
            });
    }

    function redrawPokemon (pokemonList) {
        var skipNotification = true
        $.each(pokemonList, function (key, value) {
            var item = pokemonList[key]
            if (!item.hidden) {
                var newMarker = setupPokemonMarker(item, pokemonSprites, skipNotification, this.marker.animationDisabled)
                item.marker.setMap(null)
                pokemonList[key].marker = newMarker
            }
        })
    }

    var updateAllSpawnIcons = function () {
        for (var spawnId in mapData.spawnpoints) {
            markers.updateSpawnIcon(mapData.spawnpoints[spawnId]);
        }
    };

    var updateAllPokestopIcons = function () {
        for (var pokestopId in mapData.pokestops) {
            markers.updatePokestopIcon(mapData.pokestops[pokestopId]);
        }
    };




    function myLocationButton (map, marker) {
        var locationContainer = document.createElement('div')

        var locationButton = document.createElement('button')
        locationButton.style.backgroundColor = '#fff'
        locationButton.style.border = 'none'
        locationButton.style.outline = 'none'
        locationButton.style.width = '28px'
        locationButton.style.height = '28px'
        locationButton.style.borderRadius = '2px'
        locationButton.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)'
        locationButton.style.cursor = 'pointer'
        locationButton.style.marginRight = '10px'
        locationButton.style.padding = '0px'
        locationButton.title = 'Your Location'
        locationContainer.appendChild(locationButton)

        var locationIcon = document.createElement('div')
        locationIcon.style.margin = '5px'
        locationIcon.style.width = '18px'
        locationIcon.style.height = '18px'
        locationIcon.style.backgroundImage = 'url(static/mylocation-sprite-1x.png)'
        locationIcon.style.backgroundSize = '180px 18px'
        locationIcon.style.backgroundPosition = '0px 0px'
        locationIcon.style.backgroundRepeat = 'no-repeat'
        locationIcon.id = 'current-location'
        locationButton.appendChild(locationIcon)

        locationButton.addEventListener('click', function () {
            centerMapOnLocation()
        })

        locationContainer.index = 1
        map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(locationContainer)
    }

    function centerMapOnLocation () {
        var currentLocation = document.getElementById('current-location')
        var imgX = '0'
        var animationInterval = setInterval(function () {
            if (imgX === '-18') {
                imgX = '0'
            } else {
                imgX = '-18'
            }
            currentLocation.style.backgroundPosition = imgX + 'px 0'
        }, 500)
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (position) {
                var latlng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude)
                locationMarker.setVisible(true)
                locationMarker.setOptions({
                    'opacity': 1
                })
                locationMarker.setPosition(latlng)
                map.setCenter(latlng)
                clearInterval(animationInterval)
                currentLocation.style.backgroundPosition = '-144px 0px'
            })
        } else {
            clearInterval(animationInterval)
            currentLocation.style.backgroundPosition = '0px 0px'
        }
    }

    function addMyLocationButton () {
        locationMarker = new google.maps.Marker({
            map: map,
            animation: google.maps.Animation.DROP,
            position: {
                lat: centerLat,
                lng: centerLng
            },
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillOpacity: 1,
                fillColor: '#1c8af6',
                scale: 6,
                strokeColor: '#1c8af6',
                strokeWeight: 8,
                strokeOpacity: 0.3
            }
        })
        locationMarker.setVisible(false)

        myLocationButton(map, locationMarker)

        google.maps.event.addListener(map, 'dragend', function () {
            var currentLocation = document.getElementById('current-location')
            currentLocation.style.backgroundPosition = '0px 0px'
            locationMarker.setOptions({
                'opacity': 0.5
            })
        })
    }

    function changeLocation (lat, lng) {
        var loc = new google.maps.LatLng(lat, lng)
        changeSearchLocation(lat, lng).done(function () {
            map.setCenter(loc)
            markers.searchMarker.setPosition(loc)
        })
    }

    function changeSearchLocation (lat, lng) {
        return $.post('next_loc?lat=' + lat + '&lon=' + lng, {})
    }


    function i8ln (word) {
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
            return i8lnDictionary[word]
        } else {
            // Word doesn't exist in dictionary return it as is
            return word
        }
    }


    //
    // Page Ready Exection
    //

    function initPage () {
        notifications.initNotifications();

        // populate Navbar Style menu
        $selectStyle = $('#map-style')

        // Load Stylenames, translate entries, and populate lists
        $.getJSON('static/dist/data/mapstyle.min.json').done(function (data) {
            var styleList = []

            $.each(data, function (key, value) {
                styleList.push({
                    id: key,
                    text: i8ln(value)
                })
            })

            // setup the stylelist
            $selectStyle.select2({
                placeholder: 'Select Style',
                data: styleList,
                minimumResultsForSearch: Infinity
            })

            // setup the list change behavior
            $selectStyle.on('change', function (e) {
                selectedStyle = $selectStyle.val()
                map.setMapTypeId(selectedStyle)
                store.Store.set('map_style', selectedStyle)
            })

            // recall saved mapstyle
            $selectStyle.val(store.Store.get('map_style')).trigger('change')
        })

        $selectIconResolution = $('#pokemon-icons')

        $selectIconResolution.select2({
            placeholder: 'Select Icon Resolution',
            minimumResultsForSearch: Infinity
        })

        $selectIconResolution.on('change', function () {
            store.Store.set('pokemonIcons', this.value)
            redrawPokemon(mapData.pokemons)
            redrawPokemon(mapData.lurePokemons)
        })

        $selectIconSize = $('#pokemon-icon-size')

        $selectIconSize.select2({
            placeholder: 'Select Icon Size',
            minimumResultsForSearch: Infinity
        })

        $selectIconSize.on('change', function () {
            store.Store.set('iconSizeModifier', this.value)
            redrawPokemon(mapData.pokemons)
            redrawPokemon(mapData.lurePokemons)
        })

        $selectLuredPokestopsOnly = $('#lured-pokestops-only-switch')

        $selectLuredPokestopsOnly.select2({
            placeholder: 'Only Show Lured Pokestops',
            minimumResultsForSearch: Infinity
        })

        $selectLuredPokestopsOnly.on('change', function () {
            store.Store.set('showLuredPokestopsOnly', this.value)
            updateMap()
        })

        search.loadSearchMarkerStyles($('#iconmarker-style'));
    };

    function initPage2 () {
        function formatState (state) {
            if (!state.id) {
                return state.text
            }
            var $state = $(
                '<span><i class="pokemon-sprite n' + state.element.value.toString() + '"></i> ' + state.text + '</span>'
            )
            return $state
        }

        if (store.Store.get('startAtUserLocation')) {
            centerMapOnLocation()
        }

        $selectExclude = $('#exclude-pokemon')
        $selectPokemonNotify = $('#notify-pokemon')
        $selectRarityNotify = $('#notify-rarity')
        var numberOfPokemon = 151

        // Load pokemon names and populate lists
        $.getJSON('static/dist/data/pokemon.min.json').done(function (data) {
            var pokeList = []

            $.each(data, function (key, value) {
                if (key > numberOfPokemon) {
                    return false
                }
                var _types = []
                pokeList.push({
                    id: key,
                    text: i8ln(value['name']) + ' - #' + key
                })
                value['name'] = i8ln(value['name'])
                value['rarity'] = i8ln(value['rarity'])
                $.each(value['types'], function (key, pokemonType) {
                    _types.push({
                        'type': i8ln(pokemonType['type']),
                        'color': pokemonType['color']
                    })
                })
                value['types'] = _types
                idToPokemon[key] = value
            })

            // setup the filter lists
            $selectExclude.select2({
                placeholder: i8ln('Select Pokémon'),
                data: pokeList,
                templateResult: formatState
            })
            $selectPokemonNotify.select2({
                placeholder: i8ln('Select Pokémon'),
                data: pokeList,
                templateResult: formatState
            })
            $selectRarityNotify.select2({
                placeholder: i8ln('Select Rarity'),
                data: [i8ln('Common'), i8ln('Uncommon'), i8ln('Rare'), i8ln('Very Rare'), i8ln('Ultra Rare')],
                templateResult: formatState
            })

            // setup list change behavior now that we have the list to work from
            $selectExclude.on('change', function (e) {
                excludedPokemon = $selectExclude.val().map(Number)
                clearStaleMarkers()
                store.Store.set('remember_select_exclude', excludedPokemon)
            })
            $selectPokemonNotify.on('change', function (e) {
                notifications.notifiedPokemon = $selectPokemonNotify.val().map(Number)
                store.Store.set('remember_select_notify', notifications.notifiedPokemon)
            })
            $selectRarityNotify.on('change', function (e) {
                notifications.notifiedRarity = $selectRarityNotify.val().map(String)
                store.Store.set('remember_select_rarity_notify', notifications.notifiedRarity)
            })

            // recall saved lists
            $selectExclude.val(store.Store.get('remember_select_exclude')).trigger('change')
            $selectPokemonNotify.val(store.Store.get('remember_select_notify')).trigger('change')
            $selectRarityNotify.val(store.Store.get('remember_select_rarity_notify')).trigger('change')
        })

        function updateMessageOfTheDay () {
            $.ajax({url: "message", type: 'GET', dataType: "json"})
                .done(function (result) {
                    var messageDiv = $('#message-of-the-day')[0];
                    messageDiv.innerHTML = result.message;
                    $('#infobox').show();
                });
        };
        window.setInterval(updateMessageOfTheDay, 60000);
        updateMessageOfTheDay();

        // run interval timers to regularly update map and timediffs
        setTimeout(window.setInterval(markers.updateAllLabelsDiffTime, 1000), 100)
        setTimeout(window.setInterval(entities.updateAllSpawnCycles, 1000), 400)
        setTimeout(window.setInterval(updateAllSpawnIcons, 1000), 500)
        setTimeout(window.setInterval(updateAllPokestopIcons, 1000), 800)

        // Wipe off/restore map icons when switches are toggled
        function buildSwitchChangeListener (data, dataType, storageKey) {
            return function () {
                store.Store.set(storageKey, this.checked)
                if (this.checked) {
                    updateMap()
                } else {
                    $.each(dataType, function (d, dType) {
                        $.each(data[dType], function (key, value) {
                            data[dType][key].marker.setMap(null)
                        })
                        data[dType] = {}
                    })
                }
            }
        }

        // Setup UI element interactions
        $('#gyms-switch').change(buildSwitchChangeListener(mapData, ['gyms'], 'showGyms'))
        $('#pokemon-switch').change(buildSwitchChangeListener(mapData, ['pokemons'], 'showPokemon'))
        $('#scanned-switch').change(buildSwitchChangeListener(mapData, ['scanned'], 'showScanned'))
        $('#spawnpoint-switch').change(buildSwitchChangeListener(mapData, ['spawnpoints'], 'showSpawnpoints'))

        $('#pokestops-switch').change(function () {
            var options = {
                'duration': 500
            }
            var wrapper = $('#lured-pokestops-only-wrapper')
            if (this.checked) {
                wrapper.show(options)
            } else {
                wrapper.hide(options)
            }
            return buildSwitchChangeListener(mapData, ['pokestops'], 'showPokestops').bind(this)()
        })

        $('#sound-switch').change(function () {
            store.Store.set('playSound', this.checked)
        })

        $('#geoloc-switch').change(function () {
            $('#next-location').prop('disabled', this.checked)
            $('#next-location').css('background-color', this.checked ? '#e0e0e0' : '#ffffff')
            if (!navigator.geolocation) {
                this.checked = false
            } else {
                store.Store.set('geoLocate', this.checked)
            }
        })

        $('#lock-marker-switch').change(function () {
            store.Store.set('lockMarker', this.checked)
            markers.searchMarker.setDraggable(!this.checked)
        })

        $('#search-switch').change(function () {
            searchControl(this.checked ? 'on' : 'off')
        })

        $('#start-at-user-location-switch').change(function () {
            store.Store.set('startAtUserLocation', this.checked)
        })

        if ($('#nav-accordion').length) {
            $('#nav-accordion').accordion({
                active: 0,
                collapsible: true,
                heightStyle: 'content'
            })
        }
    };


    function deirhExtensions (map) {
        map.addListener('click', function (e) {
            markers.searchMarker.setPosition(e.latLng);
            $('button.home-map-scan div.status small')[0].innerHTML = 'Click to scan [' +
                Math.round(markers.searchMarker.getPosition().lat() * 10000) / 10000 + ',' +
                Math.round(markers.searchMarker.getPosition().lng() * 10000) / 10000 + '] ';
            if ($('.home-map-scan').hasClass('started').length) {
                $('.home-map-scan').removeClass('started');
            }
        });

        // Restrict zoom
        var minZoomLevel = 14;
        google.maps.event.addListener(map, 'zoom_changed', function () {
            // var z = map.getZoom();
            if (map.getZoom() < minZoomLevel) {
                map.setZoom(minZoomLevel);
            }
        });

        $('.home-map-scan').click(function () {
            if (markers.searchMarker == null) {
                return;
            }

            $('.home-map-scan').addClass('busy');
            $('.home-map-scan').removeClass('started');
            $('.home-map-scan').removeClass('failed');

            $('button.home-map-scan div.status small')[0].innerHTML = 'Scanning of [' +
                Math.round(markers.searchMarker.getPosition().lat() * 10000) / 10000 + ',' +
                Math.round(markers.searchMarker.getPosition().lng() * 10000) / 10000 + '] started';

            $.ajax({
                url: "scan",
                type: 'GET',
                data: {
                    'lat': markers.searchMarker.getPosition().lat(),
                    'lon': markers.searchMarker.getPosition().lng(),
                    'key': 'dontspam'
                },
                dataType: "json"
            }).done(function (result) {
                $('.home-map-scan').removeClass('busy');
                if (result.result === 'received') {
                    $('.home-map-scan').addClass('started');
                } else {
                    $('.home-map-scan').addClass('failed');
                }
            });
        });

        function getActiveUsers () {
            $.ajax({
                url: "stats",
                type: 'GET',
                data: {},
                dataType: "json"
            }).done(function (result) {
                $('#user-guest-stats')[0].innerHTML = result.guests + (result.guests !== 1 ? ' guests' : ' guest');
                $('#user-member-stats')[0].innerHTML = result.members + (result.members !== 1 ? ' members' : ' member');
                $('#data-stats')[0].innerHTML = result.refreshes + " refreshes / min";
                $('#scan-stats')[0].innerHTML = result.scans + " scans / min";
                if (result.memberScanPool) {
                    $('#member-scan-pool')[0].innerHTML = "Hourly scan pool: " +
                        result.memberScanPoolLeft + " / " +
                        result.memberScanPool;
                }
            });
        }

        getActiveUsers();
        window.setInterval(getActiveUsers, 10000);

        // var infoWindow = new google.maps.InfoWindow({map: map, content: 'Detected location'});

      // Try HTML5 geolocation.
      if (navigator.geolocation && !centerOverride) {
        navigator.geolocation.getCurrentPosition(function(position) {
          var pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

                // infoWindow.setPosition(pos);
                map.setCenter(pos);
            }, function () {

            });
        } else {
            // Browser doesn't support Geolocation
        }
        ;
    }

    function onSignIn (googleUser) {
        var profile = googleUser.getBasicProfile();
        console.log('ID: ' + profile.getId()); // Do not send to your backend! Use an ID token instead.
        console.log('Name: ' + profile.getName());
        console.log('Image URL: ' + profile.getImageUrl());
        console.log('Email: ' + profile.getEmail());
        $.ajax({
            url: "auth",
            type: 'GET',
            data: {idToken: googleUser.getAuthResponse().id_token},
            dataType: "json"
        }).done(function (result) {

        });
    }

    function getPointDistance(pointA, pointB) {
        return google.maps.geometry.spherical.computeDistanceBetween(pointA, pointB)
    }

    return {
        //   default: {
        initMap: initMap,
        //   }
    }
});
