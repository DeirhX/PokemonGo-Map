//
// Global map.js variables
//
define(function (require) {
    var store = require('store');
    var mapStyles = require("map/styles");
    var search = require("map/overlay/search");
    var markers = require("map/overlay/markers");
    var notifications = require("interface/notifications");
    var mapcore = require("map/map");
    var sidebar = require("interface/bar/sidebar");
    var myLocation = require("map/overlay/mylocation");
    var labels = require("map/overlay/labels");
    var strings = require("assets/strings");
    var mapData = require("data/entities").Core.mapData;
    var spawntip = require("interface/tooltip/spawntip");
    var engine = require("engine");
    var core = require("core/base").core;

    var $selectExclude
    var $selectPokemonNotify
    var $selectRarityNotify
    var $selectIconResolution
    var $selectIconSize
    var $selectLuredPokestopsOnly

    var idToPokemon = {}

    var map





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
        core.map = new mapcore.Map(map);

        mapStyles.initStyles();
        mapStyles.watchStyleChange();

        core.map.onCenterChange((lat, lng) => {
            if (history.pushState) {
                var newurl = window.location.protocol + "//" + window.location.host + window.location.pathname +
                    `?lat=${String(lat).substring(0, 8)}&lng=${String(lng).substring(0, 8)}`;
                window.history.pushState({path: newurl}, '', newurl);
            }
        });

        // search.createSearchMarker(map.getCenter().lat(), map.getCenter().lng())

        myLocation.addMyLocationButton(centerLat, centerLng);
        sidebar.initSidebar();

        core.map.onFinishedMove(() => engine.updateMap());

        notifications.initNotifications();

        function setupIconStylePicker () {
            let $selectIconResolution = $('#pokemon-icons')

            $selectIconResolution.select2({
                placeholder: 'Select Icon Resolution',
                minimumResultsForSearch: Infinity
            })

            $selectIconResolution.on('change', function () {
                store.Store.set('pokemonIcons', this.value)
                engine.redrawPokemonMarkers(mapData.pokemons)
                engine.redrawPokemonMarkers(mapData.lurePokemons)
            })

            let $selectIconSize = $('#pokemon-icon-size')

            $selectIconSize.select2({
                placeholder: 'Select Icon Size',
                minimumResultsForSearch: Infinity
            })

            $selectIconSize.on('change', function () {
                store.Store.set('iconSizeModifier', this.value)
                engine.redrawPokemonMarkers(mapData.pokemons)
                engine.redrawPokemonMarkers(mapData.lurePokemons)
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
            engine.updateMap()
        })

        search.loadSearchMarkerStyles($('#iconmarker-style'));

        $("#owned-locations, #shared-locations, #shared-locations-guest").on('change', function() {
            var location = $(this).find(":selected").data("value");
            if (location.latitude && location.longitude) {
                core.map.setCenter(new google.maps.LatLng(location.latitude, location.longitude));
            }
        });

        engine.initialize();

        initPage2();

        core.map.onZoomChange((lat, lng, zoom) => {
            engine.redrawPokemonMarkers(mapData.pokemons);
            engine.redrawPokemonMarkers(mapData.lurePokemons)
        });

        deirhExtensions(map);

        var updateTimer = window.setInterval(engine.updateMap, 5000, true);
        $(window).blur(function () {
            // window.clearInterval(updateTimer);
        });
        $(window).focus(function () {
            window.clearInterval(updateTimer);
            updateTimer = window.setInterval(engine.updateMap, 5000, true);
        });


        return map;
    };

    var searchControlURI = 'search_control';

    function searchControl (action) {
        $.post(searchControlURI + '?action=' + encodeURIComponent(action))
    }








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
                engine.excludedPokemon = $selectExclude.val().map(Number);
                engine.clearStaleMarkers();
                engine.updatePokemonHiddenStatus();
                store.Store.set('remember_select_exclude', engine.excludedPokemon)
            })
            $selectPokemonNotify.on('change', function (e) {
                notifications.notifiedPokemon = $selectPokemonNotify.val().map(Number)
                store.Store.set('remember_select_notify', notifications.notifiedPokemon)
                engine.redrawPokemonMarkers(mapData.pokemons)
                engine.redrawPokemonMarkers(mapData.lurePokemons)
            })
            $selectRarityNotify.on('change', function (e) {
                notifications.notifiedRarity = $selectRarityNotify.val().map(String)
                store.Store.set('remember_select_rarity_notify', notifications.notifiedRarity)
                engine.redrawPokemonMarkers(mapData.pokemons)
                engine.redrawPokemonMarkers(mapData.lurePokemons)
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
        setTimeout(window.setInterval(engine.updateAllSpawns, 1000), 500)
        setTimeout(window.setInterval(engine.updateAllPokestopIcons, 1000), 800)

        // Wipe off/restore map icons when switches are toggled
        function buildSwitchChangeListener (data, dataType, storageKey) {
            return function () {
                store.Store.set(storageKey, this.checked)
                if (this.checked) {
                    engine.updateMap()
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
        /*
        map.addListener('click', function (e) {
            search.searchMarker.setPosition(e.latLng);
            var lat = e.latLng.lat();
            var lng = e.latLng.lng();
            if ($('button.home-map-scan div.status small').length) {
                $('button.home-map-scan div.status small')[0].innerHTML = 'Click to scan [' +
                    Math.round(search.searchMarker.getPosition().lat() * 10000) / 10000 + ',' +
                    Math.round(search.searchMarker.getPosition().lng() * 10000) / 10000 + '] ';
                if ($('.home-map-scan').hasClass('started').length) {
                    $('.home-map-scan').removeClass('started');
                }
            }
        });*/

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

            if ($('button.home-map-scan div.status small').length) {
                $('button.home-map-scan div.status small')[0].innerHTML = 'Scanning of [' +
                    Math.round(search.searchMarker.getPosition().lat() * 10000) / 10000 + ',' +
                    Math.round(search.searchMarker.getPosition().lng() * 10000) / 10000 + '] started';
            }

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