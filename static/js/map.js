//
// Global map.js variables
//
define(function (require) {

  var store = require('store');
  var mapStyles = require("map/styles").default;
  var createSearchMarker = require("map/markers").createSearchMarker;
  var loadSearchMarkerStyles = require("map/markers").loadSearchMarkerStyles;
  var pokemonLabel = require("map/overlay/labels").pokemonLabel;
  var core = require("map/core");

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
  var notifiedPokemon = []
  var notifiedRarity = []

  var map
  var rawDataIsLoading = false
  var locationMarker
  var searchMarker
  var infoWindowsOpen = []
  var highlightedMarker


  var selectedStyle = 'light'

  var mapData = {
    pokemons: {},
    gyms: {},
    pokestops: {},
    lurePokemons: {},
    scanned: {},
    spawnpoints: {}
  }
  var gymTypes = ['Uncontested', 'Mystic', 'Valor', 'Instinct']
  var audio = new Audio('static/sounds/ding.mp3')
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

  function removePokemonMarker (encounterId) { // eslint-disable-line no-unused-vars
    mapData.pokemons[encounterId].marker.setMap(null)
    mapData.pokemons[encounterId].hidden = true
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

    var styleNoLabels = new google.maps.StyledMapType(mapStyles.noLabelsStyle, {
      name: 'No Labels'
    })
    map.mapTypes.set('nolabels_style', styleNoLabels)

    var styleDark = new google.maps.StyledMapType(mapStyles.darkStyle, {
      name: 'Dark'
    })
    map.mapTypes.set('dark_style', styleDark)

    var styleLight2 = new google.maps.StyledMapType(mapStyles.light2Style, {
      name: 'Light2'
    })
    map.mapTypes.set('style_light2', styleLight2)

    var stylePgo = new google.maps.StyledMapType(mapStyles.pGoStyle, {
      name: 'PokemonGo'
    })
    map.mapTypes.set('style_pgo', stylePgo)

    var styleDarkNl = new google.maps.StyledMapType(mapStyles.darkStyleNoLabels, {
      name: 'Dark (No Labels)'
    })
    map.mapTypes.set('dark_style_nl', styleDarkNl)

    var styleLight2Nl = new google.maps.StyledMapType(mapStyles.light2StyleNoLabels, {
      name: 'Light2 (No Labels)'
    })
    map.mapTypes.set('style_light2_nl', styleLight2Nl)

    var stylePgoNl = new google.maps.StyledMapType(mapStyles.pGoStyleNoLabels, {
      name: 'PokemonGo (No Labels)'
    })
    map.mapTypes.set('style_pgo_nl', stylePgoNl)

    map.addListener('maptypeid_changed', function (s) {
      store.Store.set('map_style', this.mapTypeId)
    })

    map.setMapTypeId(store.Store.get('map_style'))
    google.maps.event.addListener(map, 'idle', function () {
        if (history.pushState) {
            var newurl = window.location.protocol + "//" + window.location.host + window.location.pathname +
                `?lat=${String(map.getCenter().lat()).substring(0, 8)}&lng=${String(map.getCenter().lng()).substring(0, 8)}`;
            window.history.pushState({path: newurl}, '', newurl);
        }
        updateMap();
    });

    searchMarker = createSearchMarker(map.getCenter().lat(), map.getCenter().lng())

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

  function pad (number) {
    return number <= 99 ? ('0' + number).slice(-2) : number
  }

  function spawnLabel (id, latitude, longitude, spawnTime) {
    var str;
      str = `
        <div id="spawn-content">
          <b>Loading...</b>
        </div>`;

    return str;
  }
  function gymLabel (teamName, teamId, gymPoints, latitude, longitude) {
    var gymColor = ['0, 0, 0, .4', '74, 138, 202, .6', '240, 68, 58, .6', '254, 217, 40, .6']
    var str
    if (teamId === 0) {
      str = `
        <div>
          <center>
            <div>
              <b style='color:rgba(${gymColor[teamId]})'>${teamName}</b><br>
              <img height='70px' style='padding: 5px;' src='static/forts/${teamName}_large.png'>
            </div>
            <div>
              Location: ${latitude.toFixed(6)}, ${longitude.toFixed(7)}
            </div>
            <div>
              <a href='https://www.google.com/maps/dir/Current+Location/${latitude},${longitude}?hl=en' target='_blank' title='View in Maps'>Get directions</a>
            </div>
          </center>
        </div>`
    } else {
      var gymPrestige = [2000, 4000, 8000, 12000, 16000, 20000, 30000, 40000, 50000]
      var gymLevel = 1
      while (gymPoints >= gymPrestige[gymLevel - 1]) {
        gymLevel++
      }
      str = `
        <div>
          <center>
            <div style='padding-bottom: 2px'>
              Gym owned by:
            </div>
            <div>
              <b style='color:rgba(${gymColor[teamId]})'>Team ${teamName}</b><br>
              <img height='70px' style='padding: 5px;' src='static/forts/${teamName}_large.png'>
            </div>
            <div>
              Level: ${gymLevel} | Prestige: ${gymPoints}
            </div>
            <div>
              Location: ${latitude.toFixed(6)}, ${longitude.toFixed(7)}
            </div>
            <div>
              <a href='https://www.google.com/maps/dir/Current+Location/${latitude},${longitude}?hl=en' target='_blank' title='View in Maps'>Get directions</a>
            </div>
          </center>
        </div>`
    }

    return str
  }

  function pokestopLabel (expireTime, latitude, longitude) {
    var str
    if (expireTime && new Date(expireTime) > new Date()) {
      var expireDate = new Date(expireTime)

      str = `
        <div>
          <b>Lured Pokéstop</b>
        </div>
        <div>
          Lure expires at ${pad(expireDate.getHours())}:${pad(expireDate.getMinutes())}:${pad(expireDate.getSeconds())}
          <span class='label-countdown' disappears-at='${expireTime}'>(00m00s)</span>
        </div>
        <div>
          Location: ${latitude.toFixed(6)}, ${longitude.toFixed(7)}
        </div>
        <div>
          <a href='https://www.google.com/maps/dir/Current+Location/${latitude},${longitude}?hl=en' target='_blank' title='View in Maps'>Get directions</a>
        </div>`
    } else {
      str = `
        <div>
          <b>Pokéstop</b>
        </div>
        <div>
          Location: ${latitude.toFixed(6)}, ${longitude.toFixed(7)}
        </div>
        <div>
          <a href='https://www.google.com/maps/dir/Current+Location/${latitude},${longitude}?hl=en' target='_blank' title='View in Maps'>Get directions</a>
        </div>`
    }

    return str
  }

  function getGoogleSprite (index, sprite, displayHeight) {
    displayHeight = Math.max(displayHeight, 3)
    var scale = displayHeight / sprite.iconHeight
    // Crop icon just a tiny bit to avoid bleedover from neighbor
    var scaledIconSize = new google.maps.Size(scale * sprite.iconWidth - 1, scale * sprite.iconHeight - 1)
    var scaledIconOffset = new google.maps.Point(
      (index % sprite.columns) * sprite.iconWidth * scale + 0.5,
      Math.floor(index / sprite.columns) * sprite.iconHeight * scale + 0.5)
    var scaledSpriteSize = new google.maps.Size(scale * sprite.spriteWidth, scale * sprite.spriteHeight)
    var scaledIconCenterOffset = new google.maps.Point(scale * sprite.iconWidth / 2, scale * sprite.iconHeight / 2)

    return {
      url: sprite.filename,
      size: scaledIconSize,
      scaledSize: scaledSpriteSize,
      origin: scaledIconOffset,
      anchor: scaledIconCenterOffset
    }
  }

  function setupPokemonMarker (item, skipNotification, isBounceDisabled) {
    // Scale icon size up with the map exponentially
    var iconSize = 2 + (map.getZoom() - 3) * (map.getZoom() - 3) * 0.2 + store.Store.get('iconSizeModifier')
    var pokemonIndex = item['pokemon_id'] - 1
    var sprite = pokemonSprites[store.Store.get('pokemonIcons')] || pokemonSprites['highres']
    var icon = getGoogleSprite(pokemonIndex, sprite, iconSize)

    var animationDisabled = false
    if (isBounceDisabled === true) {
      animationDisabled = true
    }

    var marker = new google.maps.Marker({
      position: {
        lat: item['latitude'],
        lng: item['longitude']
      },
      map: map,
      icon: icon,
      zIndex: 10,
      animationDisabled: animationDisabled
    })

    marker.addListener('click', function () {
      this.setAnimation(null)
      this.animationDisabled = true
    })

    marker.infoWindow = new google.maps.InfoWindow({
      content: pokemonLabel(item['pokemon_name'], item['pokemon_rarity'], item['pokemon_types'], item['disappear_time'], item['pokemon_id'], item['latitude'], item['longitude'], item['encounter_id']),
      disableAutoPan: true
    })

    if (notifiedPokemon.indexOf(item['pokemon_id']) > -1 || notifiedRarity.indexOf(item['pokemon_rarity']) > -1) {
      if (!skipNotification) {
        if (store.Store.get('playSound')) {
          audio.play()
        }
        sendNotification('A wild ' + item['pokemon_name'] + ' appeared!', 'Click to load map', 'static/icons/' + item['pokemon_id'] + '.png', item['latitude'], item['longitude'])
      }
      if (marker.animationDisabled !== true) {
        marker.setAnimation(google.maps.Animation.BOUNCE)
      }
    }

    addListeners(marker)
    return marker
  }

  function fastForwardSpawnTimes (spawnTemplate) {
      var now = new Date();
      if (now > spawnTemplate.disappearsAt) {
          var hourDiff = Math.floor(Math.abs(now - spawnTemplate.disappearsAt) / 36e5) + 1;
          spawnTemplate.appearsAt.setHours(spawnTemplate.appearsAt.getHours() + hourDiff);
          spawnTemplate.disappearsAt.setHours(spawnTemplate.disappearsAt.getHours() + hourDiff);
      }
  }

  function setupSpawnMarker (item, skipNotification, isBounceDisabled) {

    var marker = new google.maps.Marker({
      position: {
        lat: item.latitude,
        lng: item.longitude,
      },
      zIndex: 3,
      map: map,
      icon: 'static/images/spawn-tall.png'
    });

      marker.spawnData = item;
      item.marker = marker;
      item.appearsAt = new Date(item.last_appear);
      item.disappearsAt = new Date(item.last_disappear);
      updateSpawnIcon(item);

    marker.infoWindow = new google.maps.InfoWindow({
      content: spawnLabel(item.id, item.latitude, item.longitude),
      disableAutoPan: true,
    });
    marker.infoWindow.addListener('domready', function () {
      $.ajax({
        url: "spawn_detail",
        type: 'GET',
        data: {
          'id': item.id
        },
        dataType: "json",
        cache: false,
        complete: function (data) {
          if (highlightedMarker != marker) {
            return
          }
          if (data && data.responseJSON && data.responseJSON['rank'] && data.responseJSON['chances']) {
            item.rank = data.responseJSON['rank'];
            var rankChanceMod = 1 - (0.75 / item.rank);
            var percentHtml = "";
            var iconHtml = "";
            var table = "";
            data.responseJSON['chances'].sort(function(a, b){
              return ((a.chance < b.chance) ? +1 : ((a.chance > b.chance) ? -1 : 0));
            });
            var max_entries = 5
            for (var i = 0; i < Math.min(data.responseJSON['chances'].length, max_entries); ++i) {
              var entry = data.responseJSON['chances'][i];
              var pokemon_index = entry.pokemon_id - 1;
              var sprite = pokemonSprites[store.Store.get('pokemonIcons')] || pokemonSprites['highres']
              var icon_size = 32;
              var icon = getGoogleSprite(pokemon_index, sprite, icon_size);
              table += `
          <span class="spawn-entry"><div><a href='http://www.pokemon.com/us/pokedex/${entry.pokemon_id}' target='_blank' title='View in Pokedex'>
              <icon style='width: ${icon.size.width}px; height: ${icon.size.height}px; background-image: url("${icon.url}"); 
              background-size: ${icon.scaledSize.width}px ${icon.scaledSize.height}px; background-position: -${icon.origin.x}px -${icon.origin.y}px; background-repeat: no-repeat;'></icon></a>
          </div><div class="chance">${Math.round(entry.chance*rankChanceMod)}%</div></span>`;
              //<span>${entry.chance}%</span>
            }
              var despawn_time = new Date(data.responseJSON['despawn']);
              var spawn_time = new Date(data.responseJSON['spawn']);
            var str = `
           <div>
             <div class="spawn-window">
              <div>
                <div class="header">Most likely to appear:</div>
                <div class="spawn-table">
                  ${table}
                </div>
              </div>
              
              <div class="spawn-timing">
                  <div class="spawn-inactive" spawns-at='${spawn_time.getTime()}'>
                      Next spawn at: 
                      <span class='label-nextspawn'>${pad(spawn_time.getHours())}:${pad(spawn_time.getMinutes())}:${pad(spawn_time.getSeconds())}</span> 
                      <span class='label-countdown appear-countdown' disappears-at='${spawn_time.getTime()}'>(00m00s)</span>
                  </div>
                  <div class="spawn-active" despawns-at='${despawn_time.getTime()}'>
                      Disappears in: 
                      <span class='label-countdown disappear-countdown' disappears-at='${despawn_time.getTime()}'>(00m00s)</span>
                  </div>
              </div>
              <div>
                <a href='https://www.google.com/maps/dir/Current+Location/${item.latitude},${item.longitude}' target='_blank' title='View in Maps'>Get directions</a>
              </div>
             </div>
            </div>`;
          }
          else {
            var str = "Error retrieving data";
          }

            var $dom = $(str);
            $dom.data('spawn', item);
            $dom.data('marker', marker);
            updateSpawnCycle($dom, true);
            var html = $dom.html();

          closeMarkerWindow(marker.infoWindow);
          marker.infoWindow = new google.maps.InfoWindow({
            content: html,
            disableAutoPan: true
          });
            marker.infoWindow.addListener('domready', function(element) {
                var iwOuter = $('.gm-style-iw').find('.spawn-timing').each(function(index, element) {
                  $(element).data('spawn', item);
                  $(element).data('marker', marker);
                    updateSpawnCycle(element);
                });
            });
          openMarkerWindow(marker);
        }
      });
    });

    addListeners(marker);
    return marker;
  }


  function setupGymMarker (item) {
    var marker = new google.maps.Marker({
      position: {
        lat: item['latitude'],
        lng: item['longitude'],
      },
      zIndex: 5,
      map: map,
      icon: 'static/forts/' + gymTypes[item['team_id']] + '.png'
    })

    marker.infoWindow = new google.maps.InfoWindow({
      content: gymLabel(gymTypes[item['team_id']], item['team_id'], item['gym_points'], item['latitude'], item['longitude']),
      disableAutoPan: true
    })

    addListeners(marker)
    return marker
  }

  function updateGymMarker (item, marker) {
    marker.setIcon('static/forts/' + gymTypes[item['team_id']] + '.png')
    marker.infoWindow.setContent(gymLabel(gymTypes[item['team_id']], item['team_id'], item['gym_points'], item['latitude'], item['longitude']))
    return marker
  }

  function getPokestopIcon(item) {
    var isLured = item['lure_expiration'] && item['lure_expiration'] > new Date().getTime()
    var imagename = isLured ? 'PstopLured' : 'Pstop'
    return 'static/forts/' + imagename + '.png'
  }

  function setupPokestopMarker (item) {

    var marker = new google.maps.Marker({
      position: {
        lat: item['latitude'],
        lng: item['longitude']
      },
      map: map,
      zIndex: 2,
    })
    marker.setIcon(getPokestopIcon(item))
    marker.infoWindow = new google.maps.InfoWindow({
      content: pokestopLabel(item['lure_expiration'], item['latitude'], item['longitude']),
      disableAutoPan: true
    })

    addListeners(marker)
    return marker
  }

  function getColorByDate (value) {
    // Changes the color from red to green over 15 mins
    var diff = (Date.now() - value) / 1000 / 60 / 15

    if (diff > 1) {
      diff = 1
    }

    // value from 0 to 1 - Green to Red
    var hue = ((1 - diff) * 120).toString(10)
    return ['hsl(', hue, ',100%,50%)'].join('')
  }

  function setupScannedMarker (item) {
    var circleCenter = new google.maps.LatLng(item['latitude'], item['longitude'])

    var marker = new google.maps.Circle({
      map: map,
      center: circleCenter,
      radius: 60, // metres
      fillColor: getColorByDate(item['last_update']),
      strokeWeight: 1,
      zIndex: 1,
      clickable: false,
    })

    return marker
  }

  function clearSelection () {
    if (document.selection) {
      document.selection.empty()
    } else if (window.getSelection) {
      window.getSelection().removeAllRanges()
    }
  }

  function addListeners (marker) {
    marker.addListener('click', function () {

      if (!marker.persist) {
        openMarkerWindow(marker);
        marker.persist = true;
      } else {
        closeMarkerWindow(marker);
        marker.persist = false;
      }

      clearSelection();
      updateAllLabelsDiffTime();

    });

    google.maps.event.addListener(marker.infoWindow, 'closeclick', function () {
      marker.persist = null
    })

    marker.addListener('mouseover', function () {
      openMarkerWindow(marker);
      clearSelection()
      updateAllLabelsDiffTime();
      highlightedMarker = marker
    })

    marker.addListener('mouseout', function () {
      if (!marker.persist) {
        closeMarkerWindow(marker.infoWindow);
      }
      highlightedMarker = null
    })

    return marker
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
          fillColor: getColorByDate(mapData.scanned[key]['last_update'])
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
  function loadRawData(incremental) {

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
        'key' : 'dontspam',
        'lastTimestamps' : incrementalTimestamps
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
      complete: function(data) {
        if (incremental && data.responseJSON)
          lastReceivedObjects = data.responseJSON.lastTimestamps;
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
        item.marker = setupPokemonMarker(item)
        mapData.pokemons[item['encounter_id']] = item
      }
    }
  }

  function processSpawns(i, item) {
    if (!store.Store.get('showSpawnpoints')) {
      return false; // in case the checkbox was unchecked in the meantime.
    }

    if (!(item.id in mapData.spawnpoints)) {
      // add marker to map and item to dict
      if (item.marker) item.marker.setMap(null);
      if (!item.hidden) {
        item.marker = setupSpawnMarker(item);
        mapData.spawnpoints[item.id] = item;
      }
    }
  }


  function processPokestops(i, item) {
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
      item.marker = setupPokestopMarker(item)
      mapData.pokestops[item['pokestop_id']] = item
    } else {
      var item2 = mapData.pokestops[item['pokestop_id']]
      if (!!item['lure_expiration'] !== !!item2['lure_expiration']) {
        item2.marker.setMap(null)
        item.marker = setupPokestopMarker(item)
        mapData.pokestops[item['pokestop_id']] = item
      }
    }
  }

  function processGyms (i, item) {
    if (!store.Store.get('showGyms')) {
      return false // in case the checkbox was unchecked in the meantime.
    }

    if (item['gym_id'] in mapData.gyms) {
      item.marker = updateGymMarker(item, mapData.gyms[item['gym_id']].marker)
    } else { // add marker to map and item to dict
      item.marker = setupGymMarker(item)
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
        fillColor: getColorByDate(item['last_update'])
      })
    } else { // add marker to map and item to dict
      if (item.marker) {
        item.marker.setMap(null)
      }
      item.marker = setupScannedMarker(item)
      mapData.scanned[scanId] = item
    }
  }

  function updateMap(incremental) {
    loadRawData(incremental)
        .done(function(result) {
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
        var newMarker = setupPokemonMarker(item, skipNotification, this.marker.animationDisabled)
        item.marker.setMap(null)
        pokemonList[key].marker = newMarker
      }
    })
  }

  function updateSpawnCycle(element, first) {
      var spawn = $(element).data('spawn');
      if (!spawn) {
        return;
      }
      var marker = $(element).data('marker');
      var inactiveContent = $(element).find('.spawn-inactive');
      var activeContent = $(element).find('.spawn-active');
      var now = new Date();
      var justAppeared, justDisappeared;

      if (now > spawn.appearsAt) {
          justAppeared = true;
      }
      if (now > spawn.disappearsAt) {
          justAppeared = false;
          justDisappeared = true;

          fastForwardSpawnTimes(spawn);
          activeContent.attr("despawns-at", spawn.disappearsAt.getTime());
          inactiveContent.attr("spawns-at", spawn.appearsAt.getTime());
      }

      if (first) { // Initial update
          justAppeared = justDisappeared = false;
          if (now >= spawn.appearsAt && now <= spawn.disappearsAt) {
              justAppeared = true;
          } else {
              justDisappeared = true;
          }
      }

      if (justAppeared) { // Switch to 'active' state
          inactiveContent.hide();
          activeContent.show();
          activeContent.find(".disappear-countdown").removeClass("disabled");
          inactiveContent.find(".appear-countdown").addClass("disabled");
          if (marker) {
            marker.setOpacity(1.0);
          }
      } else if (justDisappeared) {
          activeContent.hide();
          inactiveContent.show();
          inactiveContent.find(".appear-countdown").removeClass("disabled");
          activeContent.find(".disappear-countdown").addClass("disabled");

          inactiveContent.find(".label-nextspawn")[0].innerHTML = pad(spawn.appearsAt.getHours()) +
              ':' + pad(spawn.appearsAt.getMinutes()) +':' + pad(spawn.appearsAt.getSeconds());
          if (marker) {
            marker.setOpacity(0.3);
          }
      }

      if (justAppeared || justDisappeared) { // Immediately update countdowns if state has changed
          activeContent.find('.disappear-countdown').attr('disappears-at', spawn.disappearsAt.getTime());
          inactiveContent.find('.appear-countdown').attr('disappears-at', spawn.appearsAt.getTime());
          updateLabelDiffTime(activeContent.find('.disappear-countdown')[0]);
          updateLabelDiffTime(inactiveContent.find('.appear-countdown')[0]);
      }
  }

  var updateAllSpawnCycles = function () {
      $('.spawn-timing').each(function(index, element) {
          updateSpawnCycle($(element));
      });
  };

  var updateSpawnIcon = function (spawn) {
      fastForwardSpawnTimes(spawn);
      if (new Date() >= spawn.appearsAt && new Date() <= spawn.disappearsAt) {
          spawn.marker.setOpacity(1.0);
      } else {
          spawn.marker.setOpacity(0.3);
      }
  };

  var updateAllSpawnIcons = function () {
    for (var spawnId in mapData.spawnpoints) {
      updateSpawnIcon(mapData.spawnpoints[spawnId]);
    }
  };

  var updatePokestopIcon = function(pokestop) {
    var currentIcon = pokestop.marker.getIcon()
    var newIcon = getPokestopIcon(pokestop)
    if (newIcon != currentIcon)
      pokestop.marker.setIcon(newIcon)
  };

  var updateAllPokestopIcons = function() {
    for (var pokestopId in mapData.pokestops) {
      updatePokestopIcon(mapData.pokestops[pokestopId]);
    }
  };

  var updateLabelDiffTime = function(element) {
      var disappearsAt = new Date(parseInt(element.getAttribute("disappears-at")));
      var now = new Date();

      var difference = Math.abs(disappearsAt - now)
      var hours = Math.floor(difference / 36e5)
      var minutes = Math.floor((difference - (hours * 36e5)) / 6e4)
      var seconds = Math.floor((difference - (hours * 36e5) - (minutes * 6e4)) / 1e3)
      var timestring = ''

      if (disappearsAt < now) {
        timestring = '(expired)'
      } else {
        timestring = "(";
        if (hours > 0)
            timestring = hours + "h";

        timestring += ('0' + minutes).slice(-2) + 'm'
        timestring += ('0' + seconds).slice(-2) + 's'
        timestring += ')'
      }

      $(element).text(timestring)
  };

  var updateAllLabelsDiffTime = function() {
    $('.label-countdown').each(function(index, element) {
        if (!$(element).hasClass('disabled')) {
          updateLabelDiffTime(element);
        }
    });
  };

  function getPointDistance (pointA, pointB) {
    return google.maps.geometry.spherical.computeDistanceBetween(pointA, pointB)
  }

  function sendNotification (title, text, icon, lat, lng) {
    if (!('Notification' in window)) {
      return false // Notifications are not present in browser
    }

    if (Notification.permission !== 'granted') {
      Notification.requestPermission()
    } else {
      var notification = new Notification(title, {
        icon: icon,
        body: text,
        sound: 'sounds/ding.mp3'
      })

      notification.onclick = function () {
        window.focus()
        notification.close()

        centerMap(lat, lng, 20)
      }
    }
  }

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
      searchMarker.setPosition(loc)
    })
  }

  function changeSearchLocation (lat, lng) {
    return $.post('next_loc?lat=' + lat + '&lon=' + lng, {})
  }

  function centerMap (lat, lng, zoom) {
    var loc = new google.maps.LatLng(lat, lng)

    map.setCenter(loc)

    if (zoom) {
      map.setZoom(zoom)
    }
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

  function initPage() {
    if (!Notification) {
      console.log('could not load notifications')
      return
    }

    if (Notification.permission !== 'granted') {
      Notification.requestPermission()
    }

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

    loadSearchMarkerStyles($('#iconmarker-style'));

  };

  function initPage2() {
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
        notifiedPokemon = $selectPokemonNotify.val().map(Number)
        store.Store.set('remember_select_notify', notifiedPokemon)
      })
      $selectRarityNotify.on('change', function (e) {
        notifiedRarity = $selectRarityNotify.val().map(String)
        store.Store.set('remember_select_rarity_notify', notifiedRarity)
      })

      // recall saved lists
      $selectExclude.val(store.Store.get('remember_select_exclude')).trigger('change')
      $selectPokemonNotify.val(store.Store.get('remember_select_notify')).trigger('change')
      $selectRarityNotify.val(store.Store.get('remember_select_rarity_notify')).trigger('change')
    })

    function updateMessageOfTheDay() {
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
    setTimeout(window.setInterval(updateAllLabelsDiffTime, 1000), 100)
    setTimeout(window.setInterval(updateAllSpawnCycles, 1000), 400)
    setTimeout(window.setInterval(updateAllSpawnIcons, 1000), 500)
    setTimeout(window.setInterval(updateAllPokestopIcons, 1000), 800)

    window.setInterval(function() {
      if (navigator.geolocation && store.Store.get('geoLocate')) {
        navigator.geolocation.getCurrentPosition(function (position) {
          var baseURL = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '')
          var lat = position.coords.latitude
          var lon = position.coords.longitude

          // the search function makes any small movements cause a loop. Need to increase resolution
          if (getPointDistance(searchMarker.getPosition(), (new google.maps.LatLng(lat, lon))) > 40) {
            $.post(baseURL + '/next_loc?lat=' + lat + '&lon=' + lon).done(function () {
              var center = new google.maps.LatLng(lat, lon)
              map.panTo(center)
              searchMarker.setPosition(center)
            })
          }
        })
      }
    }, 1000)

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
      searchMarker.setDraggable(!this.checked)
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

  function toggleMarkerWindow(marker, newState){
    var wasOpen = false;
    for (var i = 0; i < infoWindowsOpen.length; ++i) {
      infoWindowsOpen[i].close();
      if (infoWindowsOpen[i] == marker.infoWindow)
        wasOpen = true;
    }

    infoWindowsOpen = [];
    if (newState) {
      marker.infoWindow.open(map, marker);
      infoWindowsOpen.push(marker.infoWindow);
    } else if (marker.infoWindow) {
      marker.infoWindow.close();
    }
  }

  function openMarkerWindow(marker){
    toggleMarkerWindow(marker, true);
  }

  function closeMarkerWindow(marker) {
    toggleMarkerWindow(marker, false);
  }

  function deirhExtensions(map) {

      map.addListener('click', function(e) {
           searchMarker.setPosition(e.latLng);
           $('button.home-map-scan div.status small')[0].innerHTML = 'Click to scan ['
            + Math.round(searchMarker.getPosition().lat()*10000) / 10000 + ','
            + Math.round(searchMarker.getPosition().lng()*10000) / 10000 + '] ';
          if ($('.home-map-scan').hasClass('started').length) {
            $('.home-map-scan').removeClass('started');
          }
      });

      // Restrict zoom
      var minZoomLevel = 14;
      google.maps.event.addListener(map, 'zoom_changed', function() {
       var z = map.getZoom();
       if (map.getZoom() < minZoomLevel) {
          map.setZoom(minZoomLevel);
       }
     });

      $('.home-map-scan').click(function() {
          if (searchMarker == null)
              return;

          $('.home-map-scan').addClass('busy');
          $('.home-map-scan').removeClass('started');
          $('.home-map-scan').removeClass('failed');

          $('button.home-map-scan div.status small')[0].innerHTML = 'Scanning of ['
              + Math.round(searchMarker.getPosition().lat()*10000) / 10000 + ','
              + Math.round(searchMarker.getPosition().lng()*10000) / 10000 + '] started';

          $.ajax({
              url: "scan",
              type: 'GET',
              data: {
                  'lat': searchMarker.getPosition().lat(),
                  'lon': searchMarker.getPosition().lng(),
                  'key' : 'dontspam'
              },
              dataType: "json"
          }).done(function (result) {
             $('.home-map-scan').removeClass('busy');
             if (result.result == 'received') {
                 $('.home-map-scan').addClass('started');
             } else {
                 $('.home-map-scan').addClass('failed');
             }
          });
      });

      function getActiveUsers() {
            $.ajax({
              url: "stats",
              type: 'GET',
              data: {},
              dataType: "json"
          }).done(function (result) {
              $('#user-guest-stats')[0].innerHTML = result.guests  + (result.guests != 1 ? ' guests' : ' guest');
              $('#user-member-stats')[0].innerHTML = result.members + (result.members != 1 ? ' members' : ' member');
              $('#data-stats')[0].innerHTML = result.refreshes + " refreshes / min";
              $('#scan-stats')[0].innerHTML = result.scans+ " scans / min";
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
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
          var pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          //infoWindow.setPosition(pos);
          map.setCenter(pos);
        }, function() {

        });
      } else {
        // Browser doesn't support Geolocation
      };

  }

      function onSignIn(googleUser) {
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

   return {
    //   default: {
         initMap: initMap,
    //   }
   }
});
