/// <reference path="../../../../typings/globals/jquery/index.d.ts" />
/// <reference path="../../../../typings/globals/googlemaps/index.d.ts" />
define(["require", "exports", "../core", "../../data/entities", "./labels", "../../utils", "../../utils", "../../store", "../../notifications", "../../assets/sprites", "../../interface/tooltip/spawntip", "./labels", "../../data/spawn", "../../interface/bar/spawnbar", "../../environment"], function (require, exports, core_1, entities_1, labels, utils, utils_1, store_1, notifications_1, sprites, spawntip_1, labels_1, spawn_1, spawnbar_1, environment_1) {
    "use strict";
    var infoWindowsOpen = [];
    var highlightedMarker; // Global focused marker
    var Marker = (function () {
        function Marker(mapObject, infoWindow) {
            this.listeners = [];
            if (mapObject instanceof google.maps.Marker) {
                this.marker = mapObject;
            }
            else if (mapObject instanceof google.maps.Circle) {
                this.circle = mapObject;
            }
            else {
                throw "Not supported";
            }
            this.mapObject = mapObject;
            this.infoWindow = infoWindow;
            this.registerPopupWindowListeners();
        }
        Marker.prototype.openWindow = function (overrideWindow) {
            if (overrideWindow) {
                this.infoWindow = overrideWindow;
            }
            this.toggleWindow(true);
        };
        Marker.prototype.closeWindow = function () { this.toggleWindow(false); };
        ;
        Marker.prototype.toggleWindow = function (isOpen) {
            if (!this.infoWindow) {
                return;
            }
            for (var i = 0; i < infoWindowsOpen.length; ++i) {
                infoWindowsOpen[i].close();
                if (infoWindowsOpen[i] === this.infoWindow) {
                }
            }
            infoWindowsOpen = [];
            if (isOpen) {
                this.infoWindow.open(core_1["default"].map, this.marker);
                infoWindowsOpen.push(this.infoWindow);
            }
            else if (this.infoWindow) {
                this.infoWindow.close();
            }
        };
        Marker.prototype.setWindowContent = function (htmlContent) {
            this.infoWindow.setContent(htmlContent);
        };
        Marker.prototype.show = function () {
            this.mapObject.setMap(core_1["default"].map);
        };
        Marker.prototype.hide = function () {
            this.mapObject.setMap(null);
        };
        Marker.prototype.delete = function () {
            this.unregisterPopupWindowListeners();
            this.hide();
        };
        Marker.prototype.isShown = function () {
            return this.mapObject.getMap() != null;
        };
        Marker.prototype.onClick = function (callback) {
            this.listeners.push(this.marker.addListener("click", callback));
        };
        Marker.prototype.onOpen = function (callback) {
            this.onOpenCallback = callback;
        };
        Marker.prototype.setIcon = function (icon) {
            if (!this.marker) {
                throw "Not implemented";
            }
            this.marker.setIcon(icon);
        };
        Marker.prototype.setColor = function (color) {
            if (!this.circle) {
                throw "Can change color only of polygons";
            }
            this.circle.setOptions({
                fillColor: color
            });
        };
        Marker.prototype.setOpacity = function (opacity) {
            if (!this.marker) {
                throw "Not implemented";
            }
            this.marker.setOpacity(opacity);
        };
        Marker.prototype.getPosition = function () {
            if (this.marker) {
                return this.marker.getPosition();
            }
            return null;
        };
        Marker.prototype.getBounds = function () {
            if (this.circle) {
                return this.circle.getBounds();
            }
            return null;
        };
        Marker.prototype.canAnimate = function () {
            return !!this.marker;
        };
        Marker.prototype.isAnimated = function () {
            if (!this.marker) {
                throw "Cannot animate this";
            }
            return !!this.marker.getAnimation();
        };
        Marker.prototype.setAnimation = function (animation) {
            if (!this.marker) {
                throw "Cannot animate this";
            }
            this.oldAnimation = animation;
        };
        Marker.prototype.startAnimation = function (animation) {
            if (!this.marker) {
                throw "Cannot animate this";
            }
            this.marker.setAnimation(animation);
        };
        Marker.prototype.stopAnimation = function () {
            if (!this.marker) {
                throw "Cannot animate this";
            }
            this.oldAnimation = null;
            this.marker.setAnimation(null);
        };
        Marker.prototype.pauseAnimation = function () {
            if (!this.marker) {
                throw "Cannot animate this";
            }
            this.oldAnimation = this.marker.getAnimation();
            this.marker.setAnimation(null);
        };
        Marker.prototype.resumeAnimation = function () {
            if (!this.marker) {
                throw "Cannot animate this";
            }
            this.marker.setAnimation(this.oldAnimation);
        };
        Marker.prototype.registerPopupWindowListeners = function () {
            var _this = this;
            if (!this.infoWindow) {
                return;
            }
            this.listeners.push(this.marker.addListener("click", function () {
                if (!_this.persistWindow) {
                    _this.openWindow();
                    _this.persistWindow = true;
                }
                else {
                    _this.closeWindow();
                    _this.persistWindow = false;
                }
                utils.clearSelection();
                if (_this.onOpenCallback) {
                    _this.onOpenCallback();
                }
            }));
            this.listeners.push(core_1["default"].google.maps.event.addListener(this.infoWindow, "closeclick", function () { return _this.persistWindow = false; }));
            this.listeners.push(this.marker.addListener("mouseover", function () {
                _this.openWindow();
                utils.clearSelection();
                if (_this.onOpenCallback) {
                    _this.onOpenCallback();
                }
                highlightedMarker = _this;
            }));
            this.listeners.push(this.marker.addListener("mouseout", function () {
                if (!_this.persistWindow) {
                    _this.closeWindow();
                }
                highlightedMarker = null;
            }));
        };
        Marker.prototype.unregisterPopupWindowListeners = function () {
            for (var _i = 0, _a = this.listeners; _i < _a.length; _i++) {
                var listener = _a[_i];
                listener.remove();
            }
        };
        return Marker;
    }());
    exports.Marker = Marker;
    // --- Marker updators
    function updatePokestopIcon(pokestop) {
        pokestop.marker.setIcon(sprites.getPokestopIcon(pokestop));
    }
    exports.updatePokestopIcon = updatePokestopIcon;
    function updateSpawnIcon(spawn) {
        if (spawn.state === spawn_1.SpawnState.Spawning) {
            spawn.marker.setOpacity(1.0);
        }
        else {
            spawn.marker.setOpacity(0.3);
        }
    }
    exports.updateSpawnIcon = updateSpawnIcon;
    function updateGymMarker(item, marker) {
        marker.setIcon("static/forts/" + entities_1.gymTypes[item.team_id] + ".png");
        marker.infoWindow.setContent(labels.gymLabel(entities_1.gymTypes[item.team_id], item.team_id, item.gym_points, item.latitude, item.longitude));
        return marker;
    }
    exports.updateGymMarker = updateGymMarker;
    // -- Marker creators
    function createGymMarker(item) {
        var mapObject = new core_1["default"].google.maps.Marker({
            position: {
                lat: item.latitude,
                lng: item.longitude
            },
            zIndex: 5,
            map: core_1["default"].map,
            icon: "static/forts/" + entities_1.gymTypes[item.team_id] + ".png"
        });
        var infoWindow = new core_1["default"].google.maps.InfoWindow({
            content: labels.gymLabel(entities_1.gymTypes[item.team_id], item.team_id, item.gym_points, item.latitude, item.longitude),
            disableAutoPan: true
        });
        var marker = new Marker(mapObject, infoWindow);
        marker.onOpen(labels_1.updateAllLabelsDisappearTime);
        return marker;
    }
    exports.createGymMarker = createGymMarker;
    function createPokestopMarker(item) {
        var mapObject = new core_1["default"].google.maps.Marker({
            position: {
                lat: item.latitude,
                lng: item.longitude
            },
            map: core_1["default"].map,
            zIndex: 2
        });
        mapObject.setIcon(sprites.getPokestopIcon(item));
        var infoWindow = new core_1["default"].google.maps.InfoWindow({
            content: labels.pokestopLabel(item.lure_expiration, item.latitude, item.longitude),
            disableAutoPan: true
        });
        var marker = new Marker(mapObject, infoWindow);
        marker.onClick(labels_1.updateAllLabelsDisappearTime);
        return marker;
    }
    exports.createPokestopMarker = createPokestopMarker;
    function createSpawnMarker(item, pokemonSprites, skipNotification, isBounceDisabled) {
        var mapObject = new core_1["default"].google.maps.Marker({
            position: {
                lat: item.latitude,
                lng: item.longitude
            },
            zIndex: 3,
            map: core_1["default"].map,
            icon: {
                url: "static/images/spawn.png",
                size: new core_1["default"].google.maps.Size(16, 16),
                anchor: new core_1["default"].google.maps.Point(8, -8)
            }
        });
        mapObject.spawnData = item;
        var infoWindow = new core_1["default"].google.maps.InfoWindow({
            content: labels.spawnLabel(item.id, item.latitude, item.longitude),
            disableAutoPan: true
        });
        var marker = new Marker(mapObject, infoWindow);
        marker.onClick(function () {
            if (!environment_1.isTouchDevice()) {
                spawnbar_1["default"].open();
                spawnbar_1["default"].stayOpenOnce();
            }
            if (item.detail) {
                spawnbar_1["default"].displaySpawn(item.detail);
            }
        });
        marker.onOpen(function () {
            labels_1.updateAllLabelsDisappearTime();
        });
        item.marker = marker;
        updateSpawnIcon(item);
        infoWindow.addListener("domready", function () {
            $.ajax({
                url: "spawn_detail",
                type: "GET",
                data: {
                    id: item.id
                },
                dataType: "json",
                cache: false,
                complete: function (data) {
                    if (highlightedMarker !== marker) {
                        return;
                    }
                    var spawnDetail = new spawn_1.SpawnDetail(item, data.responseJSON);
                    // Initialize sidebar
                    spawnbar_1["default"].displaySpawn(spawnDetail);
                    // Initialize tooltip
                    var str = spawntip_1.generateSpawnTooltip(spawnDetail);
                    var $dom = $(str);
                    var $root = $dom.find(".spawn-detail");
                    $root.data("spawn", spawnDetail);
                    $root.data("marker", mapObject);
                    spawntip_1.updateSpawnTooltip(spawnDetail, $root[0], true);
                    var html = $dom.html();
                    // Close 'loading' tooltip
                    marker.closeWindow();
                    var newInfoWindow = new core_1["default"].google.maps.InfoWindow({
                        content: html,
                        disableAutoPan: true
                    });
                    newInfoWindow.addListener("domready", function (element) {
                        /* var iwOuter = */
                        // Again since data items have been lost by using .html()
                        $(".gm-style-iw").find(".spawn-detail").each(function (index, el) {
                            $(el).data("spawn", spawnDetail);
                            $(el).data("marker", mapObject);
                            // updateSpawnTooltip(spawnDetail, $(el), true);
                        });
                    });
                    marker.openWindow(newInfoWindow);
                }
            });
        });
        return marker;
    }
    exports.createSpawnMarker = createSpawnMarker;
    function createPokemonMarker(item, pokemonSprites, skipNotification, isBounceDisabled) {
        // Scale icon size up with the map exponentially
        var iconSize = 2 + (core_1["default"].map.getZoom() - 3) * (core_1["default"].map.getZoom() - 3) * 0.2 + store_1.Store.get("iconSizeModifier");
        var pokemonIndex = item.pokemon_id - 1;
        var sprite = pokemonSprites[store_1.Store.get("pokemonIcons")] || pokemonSprites.highres;
        var icon = utils_1.getGoogleSprite(pokemonIndex, sprite, iconSize);
        var mapObject = new core_1["default"].google.maps.Marker({
            position: {
                lat: item.latitude,
                lng: item.longitude
            },
            map: core_1["default"].map,
            icon: icon,
            zIndex: 10,
            animationDisabled: isBounceDisabled === true
        });
        var infoWindow = new core_1["default"].google.maps.InfoWindow({
            content: labels.pokemonLabel(item.pokemon_name, item.pokemon_rarity, item.pokemon_types, item.disappear_time, item.pokemon_id, item.latitude, item.longitude, item.encounter_id),
            disableAutoPan: true
        });
        if (notifications_1.notifiedPokemon.indexOf(item.pokemon_id) > -1 || notifications_1.notifiedRarity.indexOf(item.pokemon_rarity) > -1) {
            if (!skipNotification) {
                if (store_1.Store.get("playSound")) {
                    notifications_1.playNotifySound();
                }
                notifications_1.sendNotification("A wild " + item.pokemon_name + " appeared!", "Click to load map", "static/icons/" + item.pokemon_id + ".png", item.latitude, item.longitude);
            }
            if (mapObject.animationDisabled !== true) {
                mapObject.setAnimation(core_1["default"].google.maps.Animation.BOUNCE);
            }
        }
        var marker = new Marker(mapObject, infoWindow);
        marker.onOpen(labels_1.updateAllLabelsDisappearTime);
        marker.onClick(function () {
            marker.stopAnimation();
        });
        return marker;
    }
    exports.createPokemonMarker = createPokemonMarker;
    function createScannedMarker(item) {
        var circleCenter = new core_1["default"].google.maps.LatLng(item.latitude, item.longitude);
        var marker = new core_1["default"].google.maps.Circle({
            map: core_1["default"].map,
            center: circleCenter,
            radius: 70,
            fillColor: labels.getColorByDate(item.last_update),
            strokeWeight: 1,
            zIndex: 1,
            clickable: false
        });
        return new Marker(marker, null);
    }
    exports.createScannedMarker = createScannedMarker;
});
//# sourceMappingURL=markers.js.map