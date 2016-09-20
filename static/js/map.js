//
// Global map.js variables
//
define(function (require) {
    var store = require('store');
    var mapStyles = require("map/styles");
    var search = require("map/overlay/search");
    var markers = require("map/overlay/markers");
    var notifications = require("notifications");
    var core = require("map/core");
    var entities = require("data/entities");
    var sprites = require("assets/sprites");
    var sidebar = require("interface/bar/sidebar");
    var myLocation = require("map/overlay/mylocation");
    var labels = require("map/overlay/labels");
    var strings = require("assets/strings");
    var stats = require("stats");
    var spawns = require("data/spawn");
    var mapData = require("data/entities").mapData;
    var spawntip = require("interface/tooltip/spawntip");
    var memberServer = require("members/server");

    var $selectExclude
    var $selectPokemonNotify
    var $selectRarityNotify
    var $selectIconResolution
    var $selectIconSize
    var $selectLuredPokestopsOnly

    var idToPokemon = {}

    var excludedPokemon = []

    var map
    var rawDataIsLoading = false





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

    strings.setLanguage(document.documentElement.lang === '' ? 'en' : document.documentElement.lang);

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
        core.default.map = map;
        core.default.google = google;

        mapStyles.initStyles();
        mapStyles.watchStyleChange();

        core.onCenterChange((lat, lng) => {
            if (history.pushState) {
                var newurl = window.location.protocol + "//" + window.location.host + window.location.pathname +
                    `?lat=${String(lat).substring(0, 8)}&lng=${String(lng).substring(0, 8)}`;
                window.history.pushState({path: newurl}, '', newurl);
            }
        });

        search.createSearchMarker(map.getCenter().lat(), map.getCenter().lng())

        myLocation.addMyLocationButton(centerLat, centerLng);
        sidebar.initSidebar();

        core.onFinishedMove(() => updateMap());

        notifications.initNotifications();

        function setupIconStylePicker () {
            let $selectIconResolution = $('#pokemon-icons')

            $selectIconResolution.select2({
                placeholder: 'Select Icon Resolution',
                minimumResultsForSearch: Infinity
            })

            $selectIconResolution.on('change', function () {
                store.Store.set('pokemonIcons', this.value)
                redrawPokemon(mapData.pokemons)
                redrawPokemon(mapData.lurePokemons)
            })

            let $selectIconSize = $('#pokemon-icon-size')

            $selectIconSize.select2({
                placeholder: 'Select Icon Size',
                minimumResultsForSearch: Infinity
            })

            $selectIconSize.on('change', function () {
                store.Store.set('iconSizeModifier', this.value)
                redrawPokemon(mapData.pokemons)
                redrawPokemon(mapData.lurePokemons)
            })
        }

        setupIconStylePicker();

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

        $("#owned-locations, #shared-locations, #shared-locations-guest").on('change', function() {
            var location = $(this).find(":selected").data("value");
            if (location.latitude && location.longitude) {
                core.map.setCenter(new google.maps.LatLng(location.latitude, location.longitude));
            }
        });

        initPage2()

        core.onZoomChange((lat, lng, zoom) => {
            redrawPokemon(mapData.pokemons)
            redrawPokemon(mapData.lurePokemons)
        });

        deirhExtensions(map);

        var updateTimer = window.setInterval(updateMap, 5000, true);
        $(window).blur(function () {
            // window.clearInterval(updateTimer);
        });
        $(window).focus(function () {
            window.clearInterval(updateTimer);
            updateTimer = window.setInterval(updateMap, 5000, true);
        });

        memberServer.registerChangeCallback((member, prevState) => {
            "use strict";
            console.log('Member changed.');
            if (prevState && map.getBounds()) {
                // Is already loaded with content?
                entities.clearMemberMapData();
                updateMap(false);
            }
        });

        return map;
    };

    var searchControlURI = 'search_control'

    function searchControl (action) {
        $.post(searchControlURI + '?action=' + encodeURIComponent(action))
    }

    function clearStaleMarkers () {
        $.each(mapData.pokemons, function (key, value) {
            if (mapData.pokemons[key]['disappear_time'] < new Date().getTime() ||
                excludedPokemon.indexOf(mapData.pokemons[key]['pokemon_id']) >= 0) {
                mapData.pokemons[key].marker.delete()
                delete mapData.pokemons[key]
            }
        })

        $.each(mapData.lurePokemons, function (key, value) {
            if (mapData.lurePokemons[key]['lure_expiration'] < new Date().getTime() ||
                excludedPokemon.indexOf(mapData.lurePokemons[key]['pokemon_id']) >= 0) {
                mapData.lurePokemons[key].marker.delete()
                delete mapData.lurePokemons[key]
            }
        })

        $.each(mapData.scanned, function (key, value) {
            // If older than 15mins remove
            if (mapData.scanned[key]['last_update'] < (new Date().getTime() - 15 * 60 * 1000)) {
                mapData.scanned[key].marker.delete()
                delete mapData.scanned[key]
            } else {
                // Update color
                mapData.scanned[key].marker.setColor(labels.getColorByDate(mapData.scanned[key]['last_update']));
            }
        })
    }

    function showInBoundsMarkers (markers) {
        $.each(markers, function (key, value) {
            var marker = markers[key].marker
            var show = false
            if (!markers[key].hidden) {
                var bounds = marker.getBounds();
                if (bounds) {
                    if (map.getBounds().intersects(marker.getBounds())) {
                        show = true
                    }
                } else {
                    var position = marker.getPosition();
                    if (position) {
                        if (map.getBounds().contains(marker.getPosition())) {
                            show = true
                        }
                    }
                }
            }

            if (show && !marker.isShown()) {
                marker.show()
                // Not all markers can be animated (ex: scan locations)
                if (marker.canAnimate()) {
                    marker.resumeAnimation();
                }
            } else if (!show && marker.isShown()) {
                // Not all markers can be animated (ex: scan locations)
                if (marker.canAnimate()) {
                    marker.pauseAnimation();
                }
                marker.hide();
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
                item.marker.hide()
            }
            if (!item.hidden) {
                item.marker = markers.createPokemonMarker(item, sprites.pokemonSprites)
                mapData.pokemons[item['encounter_id']] = item
            }
        }
    }

    function processSpawns (i, rawItem) {
        if (!store.Store.get('showSpawnpoints')) {
            return false; // in case the checkbox was unchecked in the meantime.
        }
        let spawn = new spawns.Spawn(rawItem);

        if (!(spawn.id in mapData.spawnpoints)) {
            // add marker to map and item to dict
            if (!rawItem.hidden) {
                markers.createSpawnMarker(spawn, sprites.pokemonSprites);
                mapData.spawnpoints[rawItem.id] = spawn;
            }
        }
    }


    function processPokestops (i, item) {
        if (!store.Store.get('showPokestops')) {
            return false
        }

        if (store.Store.get('showLuredPokestopsOnly') && !item['lure_expiration']) {
            if (mapData.pokestops[item['pokestop_id']] && mapData.pokestops[item['pokestop_id']].marker) {
                mapData.pokestops[item['pokestop_id']].marker.hide()
                delete mapData.pokestops[item['pokestop_id']]
            }
            return true
        }

        if (!mapData.pokestops[item['pokestop_id']]) { // add marker to map and item to dict
            // add marker to map and item to dict
            if (item.marker) {
                item.marker.hide()
            }
            item.marker = markers.createPokestopMarker(item)
            mapData.pokestops[item['pokestop_id']] = item
        } else {
            var item2 = mapData.pokestops[item['pokestop_id']]
            if (!!item['lure_expiration'] !== !!item2['lure_expiration']) {
                item2.marker.hide()
                item.marker = markers.createPokestopMarker(item)
                mapData.pokestops[item['pokestop_id']] = item
            }
        }
    }

    function removePokemonMarker (encounterId) { // eslint-disable-line no-unused-vars
        mapData.pokemons[encounterId].marker.hide()
        mapData.pokemons[encounterId].hidden = true
    }

    function processGyms (i, item) {
        if (!store.Store.get('showGyms')) {
            return false // in case the checkbox was unchecked in the meantime.
        }

        if (item['gym_id'] in mapData.gyms) {
            item.marker = markers.updateGymMarker(item, mapData.gyms[item['gym_id']].marker)
        } else { // add marker to map and item to dict
            item.marker = markers.createGymMarker(item)
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
            mapData.scanned[scanId].marker.setColor(labels.getColorByDate(item['last_update']));
        } else { // add marker to map and item to dict
            if (item.marker) {
                item.marker.hide()
            }
            item.marker = markers.createScannedMarker(item)
            mapData.scanned[scanId] = item
        }
    }

    var updateQueue = [];
    function updateMap (incremental) {
        if (!incremental) {
            incremental = false;
        }
        function doRequest () {
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
                        stats.countMarkers(mapData);
                    }
                })
                .then(function () {
                    updateQueue.shift(); // Remove this from queue
                    if (updateQueue.length > 0) { // Fire again if queued
                        doRequest(updateQueue[0]);
                    }
                });
        }
        if (updateQueue.length > 15) {
            return; // Throw it away, queue too long
        }
        updateQueue.push(incremental);
        if (updateQueue.length === 1) { // Fire request only if the queue was empty
            doRequest();
        }
    }

    function redrawPokemon (pokemonList) {
        var skipNotification = true
        $.each(pokemonList, function (key, value) {
            var item = pokemonList[key]
            if (!item.hidden) {
                var newMarker = markers.createPokemonMarker(item, sprites.pokemonSprites, skipNotification, this.marker.isAnimated())
                item.marker.hide()
                pokemonList[key].marker = newMarker
            }
        })
    }

    var updateAllSpawns = function () {
        var now = new Date();
        for (var spawnId in mapData.spawnpoints) {
            var spawn = mapData.spawnpoints[spawnId]
            spawn.update(now);
            markers.updateSpawnIcon(spawn);
        }
    };

    var updateAllPokestopIcons = function () {
        for (var pokestopId in mapData.pokestops) {
            markers.updatePokestopIcon(mapData.pokestops[pokestopId]);
        }
    };








    //
    // Page Ready Exection
    //

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
                    text: strings.i8ln(value['name']) + ' - #' + key
                })
                value['name'] = strings.i8ln(value['name'])
                value['rarity'] = strings.i8ln(value['rarity'])
                $.each(value['types'], function (key, pokemonType) {
                    _types.push({
                        'type': strings.i8ln(pokemonType['type']),
                        'color': pokemonType['color']
                    })
                })
                value['types'] = _types
                idToPokemon[key] = value
            })

            // setup the filter lists
            $selectExclude.select2({
                placeholder: strings.i8ln('Select Pokémon'),
                data: pokeList,
                templateResult: formatState
            })
            $selectPokemonNotify.select2({
                placeholder: strings.i8ln('Select Pokémon'),
                data: pokeList,
                templateResult: formatState
            })
            $selectRarityNotify.select2({
                placeholder: strings.i8ln('Select Rarity'),
                data: [strings.i8ln('Common'), strings.i8ln('Uncommon'), strings.i8ln('Rare'), strings.i8ln('Very Rare'), strings.i8ln('Ultra Rare')],
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
        setTimeout(window.setInterval(labels.updateAllLabelsDisappearTime, 1000), 100)
        setTimeout(window.setInterval(spawntip.updateAllSpawnTooltips, 1000), 400)
        setTimeout(window.setInterval(updateAllSpawns, 1000), 500)
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
                            data[dType][key].marker.hide()
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
            search.searchMarker.setPosition(e.latLng);
            var lat = e.latLng.lat();
            var lng = e.latLng.lng();
            $('button.home-map-scan div.status small')[0].innerHTML = 'Click to scan [' +
                Math.round(search.searchMarker.getPosition().lat() * 10000) / 10000 + ',' +
                Math.round(search.searchMarker.getPosition().lng() * 10000) / 10000 + '] ';
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
            if (search.searchMarker == null) {
                return;
            }

            $('.home-map-scan').addClass('busy');
            $('.home-map-scan').removeClass('started');
            $('.home-map-scan').removeClass('failed');

            $('button.home-map-scan div.status small')[0].innerHTML = 'Scanning of [' +
                Math.round(search.searchMarker.getPosition().lat() * 10000) / 10000 + ',' +
                Math.round(search.searchMarker.getPosition().lng() * 10000) / 10000 + '] started';

            $.ajax({
                url: "scan",
                type: 'GET',
                data: {
                    'lat': search.searchMarker.getPosition().lat(),
                    'lon': search.searchMarker.getPosition().lng(),
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


    function getPointDistance(pointA, pointB) {
        return google.maps.geometry.spherical.computeDistanceBetween(pointA, pointB)
    }

    return {
        //   default: {
        initMap: initMap,
        //   }
    }
});