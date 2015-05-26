"use strict";

angular.module("farmbuild.webmapping", [ "farmbuild.core", "farmbuild.farmdata" ]).factory("webmapping", function(farmdata, validations, $log, webmappingValidator, webmappingConverter, webMappingSession, webMappingProjections, webMappingInteractions) {
    $log.info("Welcome to Web Mapping...");
    var _isDefined = validations.isDefined, session = webMappingSession, webmapping = {
        session: session,
        farmdata: farmdata,
        validator: webmappingValidator,
        toGeoJsons: webmappingConverter.toGeoJsons,
        load: session.load,
        find: session.find,
        save: function(geoJsons) {
            var farmData = session.find();
            return session.save(webmappingConverter.toFarmData(farmData, geoJsons));
        },
        "export": session.export,
        create: farmdata.create,
        findPaddockByName: function(name) {}
    };
    function _exportFarmData(toExport) {
        if (!toExport) {
            return undefined;
        }
        return _toFarmData(toExport);
    }
    webmapping.exportFarmData = _exportFarmData;
    webmapping.actions = webMappingInteractions;
    webmapping.version = "0.1.0";
    if (typeof window.farmbuild === "undefined") {
        window.farmbuild = {
            webmapping: webmapping
        };
    } else {
        window.farmbuild.webmapping = webmapping;
    }
    return webmapping;
});

"use strict";

angular.module("farmbuild.webmapping").factory("webmappingConverter", function(farmdata, validations, $log, webmappingValidator, webMappingSession) {
    var _isDefined = validations.isDefined, webmappingConverter = {}, validator = webmappingValidator;
    function createFeatureCollection(geometry) {}
    function convertCrs(geometry, crs) {
        geometry.crs = {
            type: "name",
            properties: {
                name: crs
            }
        };
        return geometry;
    }
    function resetCrs(geometry) {
        geometry.crs = geometry.crs.properties.name;
        return geometry;
    }
    function createFeature(geometry, crs, name) {
        return {
            type: "Feature",
            geometry: angular.copy(convertCrs(geometry, crs)),
            properties: {
                name: name
            }
        };
    }
    function toGeoJsons(farmData) {
        $log.info("Extracting farm and paddocks geometry from farmData ...");
        var copied = angular.copy(farmData);
        if (!validator.validate(copied)) {
            return undefined;
        }
        var farm = copied.geometry, paddocks = [];
        copied.paddocks.forEach(function(paddock) {
            paddocks.push(createFeature(paddock.geometry, farm.crs, paddock.name));
        });
        return {
            farm: {
                type: "FeatureCollection",
                features: [ createFeature(farm, farm.crs, copied.name) ]
            },
            paddocks: {
                type: "FeatureCollection",
                features: paddocks
            }
        };
    }
    webmappingConverter.toGeoJsons = toGeoJsons;
    function toFarmData(farmData, geoJsons) {
        $log.info("Converting geoJsons.farm.features[0] and paddocks geojson to farmData ...");
        var farmFeature = geoJsons.farm.features[0], paddocks = geoJsons.paddocks;
        farmData.geometry = resetCrs(farmFeature.geometry);
        paddocks.features.forEach(function(paddockFeature, i) {
            farmData.paddocks[i].geometry = paddockFeature.geometry;
            delete farmData.paddocks[i].geometry.crs;
        });
        return farmData;
    }
    webmappingConverter.toFarmData = toFarmData;
    return webmappingConverter;
});

"use strict";

angular.module("farmbuild.webmapping").factory("openLayers", function(validations, $log) {
    var _isDefined = validations.isDefined;
    function _transform(latLng, sourceProjection, destinationProjection) {
        if (!_isDefined(latLng) || !_isDefined(sourceProjection) || !_isDefined(destinationProjection)) {
            return;
        }
        var transformed = ol.proj.transform(latLng, sourceProjection, destinationProjection);
        return new google.maps.LatLng(transformed[1], transformed[0]);
    }
    function _exportGeometry(source) {
        if (!_isDefined(source)) {
            return;
        }
        var format = new ol.format["GeoJSON"]();
        try {
            return format.writeFeatures(source.getFeatures());
        } catch (e) {
            $log.error(e);
        }
    }
    function _clear(farmSource, paddocksSource) {
        if (!_isDefined(farmSource) || !_isDefined(paddocksSource)) {
            return;
        }
        $log.info("clearing source ...");
        paddocksSource.clear();
        farmSource.clear();
    }
    function _integrateGMap(gmap, map, dataProjection) {
        if (!_isDefined(gmap) || !_isDefined(map) || !_isDefined(dataProjection)) {
            return;
        }
        $log.info("integrating google map ...");
        var view = map.getView(), targetElement = map.getTargetElement(), googleProjection = "EPSG:3857";
        view.on("change:center", function() {
            var center = ol.proj.transform(view.getCenter(), googleProjection, dataProjection);
            gmap.setCenter(new google.maps.LatLng(center[1], center[0]));
        });
        view.on("change:resolution", function() {
            gmap.setZoom(view.getZoom());
        });
        window.onresize = function() {
            var center = _transform(view.getCenter(), googleProjection, dataProjection);
            google.maps.event.trigger(gmap, "resize");
            gmap.setCenter(center);
        };
        var defaults = {
            centerNew: [ -36.22488327137526, 145.5826132801325 ],
            zoomNew: 6
        };
        var extent = map.getLayers().item(1).getSource().getExtent();
        $log.info("farm extent: %j", extent);
        if (extent[0] === Infinity) {
            gmap.controls[google.maps.ControlPosition.TOP_LEFT].push(targetElement);
            targetElement.parentNode.removeChild(targetElement);
            view.setCenter(ol.proj.transform([ defaults.centerNew[1], defaults.centerNew[0] ], dataProjection, googleProjection));
            view.setZoom(defaults.zoomNew);
            return;
        }
        gmap.controls[google.maps.ControlPosition.TOP_LEFT].push(targetElement);
        targetElement.parentNode.removeChild(targetElement);
        view.fitExtent(extent, map.getSize());
    }
    function _center(coordinates, map) {
        if (!_isDefined(coordinates) || !_isDefined(map)) {
            return;
        }
        $log.info("centring view ...");
        map.getView().setCenter(coordinates);
        map.getView().setZoom(15);
    }
    function _paddocksLayer(paddocksGeometry, dataProjection, featureProjection) {
        if (!_isDefined(paddocksGeometry) || !_isDefined(dataProjection) || !_isDefined(featureProjection)) {
            return;
        }
        $log.info("creating paddocks vector layer ...", dataProjection, featureProjection);
        var paddocksSource = new ol.source.Vector({
            features: new ol.format.GeoJSON().readFeatures(paddocksGeometry, {
                dataProjection: dataProjection,
                featureProjection: featureProjection
            })
        });
        return new ol.layer.Vector({
            source: paddocksSource,
            style: new ol.style.Style({
                fill: new ol.style.Fill({
                    color: "rgba(255, 255, 255, 0.3)"
                }),
                stroke: new ol.style.Stroke({
                    color: "#319FD3",
                    width: 1
                })
            })
        });
    }
    function _farmLayer(farmGeometry, dataProjection, featureProjection) {
        if (!_isDefined(farmGeometry) || !_isDefined(dataProjection) || !_isDefined(featureProjection)) {
            return;
        }
        $log.info("creating farm vector layer ...", dataProjection, featureProjection);
        var farmSource = new ol.source.Vector({
            features: new ol.format.GeoJSON().readFeatures(farmGeometry, {
                dataProjection: dataProjection,
                featureProjection: featureProjection
            })
        });
        return new ol.layer.Vector({
            source: farmSource,
            style: new ol.style.Style({
                fill: new ol.style.Fill({
                    color: "rgba(255, 255, 255, 0)"
                }),
                stroke: new ol.style.Stroke({
                    color: "#ff6600",
                    width: 3
                })
            })
        });
    }
    return {
        exportGeometry: _exportGeometry,
        clear: _clear,
        center: _center,
        integrateGMap: _integrateGMap,
        paddocksLayer: _paddocksLayer,
        farmLayer: _farmLayer
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingProjections", function($log, farmdata) {
    var webMappingProjections = {
        supported: farmbuild.farmdata.crsSupported
    };
    farmbuild.farmdata.crsSupported.forEach(function(crs) {
        proj4.defs(crs.name, crs.projection);
    });
    return webMappingProjections;
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingSession", function($log, farmdata, validations) {
    var webMappingSession = {}, _isDefined = validations.isDefined;
    function load(farmData) {
        var loaded = farmdata.load(farmData);
        if (!_isDefined(loaded)) {
            return undefined;
        }
        return farmData;
    }
    webMappingSession.load = load;
    function save(farmData) {
        if (!_isDefined(farmData)) {
            $log.error("Unable to save the undefined farmData!");
            return undefined;
        }
        return farmdata.update(farmData);
    }
    webMappingSession.save = save;
    webMappingSession.clear = farmdata.session.clear;
    webMappingSession.isLoadFlagSet = farmdata.session.isLoadFlagSet;
    webMappingSession.find = function() {
        return farmdata.session.find();
    };
    webMappingSession.export = function(document, farmData) {
        return farmdata.session.export(document, save(farmData));
    };
    return webMappingSession;
});

"use strict";

angular.module("farmbuild.webmapping").factory("webmappingValidator", function(validations, farmdata, $log) {
    var webmappingValidator = {
        geojsonhint: geojsonhint
    }, _isDefined = validations.isDefined, _isArray = validations.isArray, _isPositiveNumber = validations.isPositiveNumber, _isEmpty = validations.isEmpty;
    if (!_isDefined(geojsonhint)) {
        throw Error("geojsonhint must be available!");
    }
    function isGeoJsons(geoJsons) {
        var errors = geojsonhint.hint(typeof geoJsons === "string" ? geoJsons : angular.toJson(geoJsons)), isGeoJson = errors.length === 0;
        if (!isGeoJson) {
            $log.error("isGeoJsons errors: ", errors);
        }
        return isGeoJson;
    }
    webmappingValidator.isGeoJsons = isGeoJsons;
    function _validate(farmData) {
        $log.info("validating farmData...", farmData);
        if (!farmdata.validate(farmData)) {
            return false;
        }
        if (!_isDefined(farmData) || !_isDefined(farmData.geometry) || !_isDefined(farmData.geometry.crs) || !_isDefined(farmData.paddocks)) {
            $log.error("farmData must have geometry, geometry.crs, paddocks");
            return false;
        }
        return true;
    }
    webmappingValidator.validate = _validate;
    return webmappingValidator;
});

"use strict";

angular.module("farmbuild.webmapping").factory("googleaddresssearch", function(validations, $log, openLayers) {
    var countryRestrict = {
        country: "au"
    };
    function _init(targetElementId, openLayersProjection, olmap) {
        var autocomplete = new google.maps.places.Autocomplete(document.getElementById(targetElementId), {
            componentRestrictions: countryRestrict
        });
        google.maps.event.addListener(autocomplete, "place_changed", function() {
            _onPlaceChanged(autocomplete, openLayersProjection, olmap);
        });
    }
    function _onPlaceChanged(autocomplete, openLayersProjection, olmap) {
        var place = autocomplete.getPlace(), latLng;
        if (!place.geometry) {
            return;
        }
        latLng = place.geometry.location;
        _center(latLng, openLayersProjection, olmap);
    }
    function _transform(latLng, sourceProjection, destinationProjection) {
        return ol.proj.transform([ latLng.lng(), latLng.lat() ], sourceProjection, destinationProjection);
    }
    function _center(latLng, openLayersProjection, olmap) {
        var googleMapProjection = "EPSG:3857", centerPoint = _transform(latLng, openLayersProjection, googleMapProjection);
        openLayers.center(centerPoint, olmap);
    }
    return {
        init: _init
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("drawInteraction", function(validations, $log) {
    var _isDefined = validations.isDefined;
    function _create(map, farmSource, paddocksSource) {
        var drawInteraction = new ol.interaction.Draw({
            source: paddocksSource,
            type: "Polygon"
        }), drawingStatus = false;
        function _init(clipFn, selectInteraction) {
            $log.info("draw interaction init ...");
            map.addInteraction(drawInteraction);
            drawInteraction.setActive(false);
            drawInteraction.on("drawend", function(e) {
                $log.info("draw end ...");
                var feature = e.feature;
                clipFn(feature, paddocksSource, farmSource);
                setTimeout(function() {
                    paddocksSource.removeFeature(feature);
                }, 100);
                drawingStatus = false;
            });
            drawInteraction.on("drawstart", function(event) {
                $log.info("draw start ...");
                selectInteraction.interaction.getFeatures().clear();
                drawingStatus = true;
            });
        }
        function _enable() {
            drawInteraction.setActive(true);
        }
        function _disable() {
            drawInteraction.setActive(false);
        }
        function _isDrawing() {
            return drawingStatus;
        }
        return {
            init: _init,
            enable: _enable,
            disable: _disable,
            interaction: drawInteraction,
            isDrawing: _isDrawing
        };
    }
    return {
        create: _create
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingInteractions", function(validations, $log, selectInteraction, modifyInteraction, drawInteraction, snapInteraction) {
    var _isDefined = validations.isDefined, _geoJSONFormat = new ol.format["GeoJSON"](), _select, _modify, _draw, _snap, _activeLayer, _activeLayerName, _mode;
    function _destroy(map) {
        $log.info("destroying all interactions ...");
        map.getInteractions().clear();
        map.addInteraction(new ol.interaction.DragPan({
            kinetic: null
        }));
        _select = undefined;
        _modify = undefined;
        _draw = undefined;
        _snap = undefined;
        _activeLayer = undefined;
        _activeLayerName = undefined;
        _mode = undefined;
    }
    function _init(map, farmLayer, paddocksLayer, activeLayerName) {
        $log.info("interactions init ...");
        if (!_isDefined(activeLayerName) || !_isDefined(map) || !_isDefined(paddocksLayer) || !_isDefined(farmLayer)) {
            return;
        }
        if (activeLayerName === "paddocks") {
            _activeLayer = paddocksLayer;
        } else if (activeLayerName === "farm") {
            _activeLayer = farmLayer;
        } else {
            return;
        }
        _select = selectInteraction.create(map, _activeLayer);
        _modify = modifyInteraction.create(map, _select);
        _draw = drawInteraction.create(map, farmLayer.getSource(), paddocksLayer.getSource());
        _snap = snapInteraction.create(map, farmLayer.getSource(), paddocksLayer.getSource());
        _mode = "";
        _activeLayerName = activeLayerName;
        _select.init();
        _modify.init();
        _draw.init(_clip, _select);
        _snap.init();
    }
    function _featureToGeoJson(feature) {
        return angular.fromJson(_geoJSONFormat.writeFeature(feature));
    }
    function _featuresToGeoJson(features) {
        if (features.getArray) {
            return angular.fromJson(_geoJSONFormat.writeFeatures(features.getArray()));
        }
        return angular.fromJson(_geoJSONFormat.writeFeatures(features));
    }
    function _addGeoJsonFeature(layer, feature) {
        if (!_isDefined(feature)) {
            return;
        }
        $log.info("adding feature ...", feature);
        layer.getSource().addFeature(new ol.Feature({
            geometry: new ol.geom[feature.geometry.type](feature.geometry.coordinates)
        }));
        _select.interaction.getFeatures().clear();
    }
    function _merge(features) {
        $log.info("merging features ...", features);
        var toMerge;
        _remove(features, false);
        toMerge = _featuresToGeoJson(features);
        try {
            _addGeoJsonFeature(_activeLayer, turf.merge(toMerge));
            _select.interaction.getFeatures().clear();
        } catch (e) {
            $log.error(e);
        }
    }
    function _erase(feature, features) {
        try {
            features.forEach(function(layerFeature) {
                var clipper = _featureToGeoJson(layerFeature);
                feature = turf.erase(feature, clipper);
            });
            return feature;
        } catch (e) {
            $log.error(e);
        }
    }
    function _intersect(feature, features) {
        try {
            features.forEach(function(layerFeature) {
                var clipper = _featureToGeoJson(layerFeature);
                feature = turf.intersect(feature, clipper);
            });
            return feature;
        } catch (e) {
            $log.error(e);
        }
    }
    function _clip(feature, paddockSource, farmSource) {
        $log.info("clipping feature ...", feature);
        var featureToClip = _featureToGeoJson(feature);
        if (_activeLayerName === "paddocks" && (_mode === "draw" || _mode === "edit")) {
            _clipPaddocks(featureToClip, paddockSource, farmSource);
        }
        if (_activeLayerName === "paddocks" && _mode === "donut-draw") {
            _clipDonut(featureToClip);
        }
        if (_activeLayerName === "farm") {
            _clipFarm(featureToClip, farmSource);
        }
    }
    function _clipPaddocks(featureToClip, paddockSource, farmSource) {
        var clipped, paddocksFeatures = paddockSource.getFeatures(), farmFeatures = farmSource.getFeatures();
        clipped = _erase(featureToClip, paddocksFeatures);
        clipped = _intersect(clipped, farmFeatures);
        _addGeoJsonFeature(_activeLayer, clipped);
    }
    function _clipDonut(donutFeature) {
        var clipped, paddockFeature, paddockGeoJsonFeature;
        paddockFeature = _activeLayer.getSource().getFeaturesAtCoordinate(donutFeature.geometry.coordinates[0][1])[0];
        paddockGeoJsonFeature = _featureToGeoJson(paddockFeature);
        clipped = turf.erase(paddockGeoJsonFeature, donutFeature);
        _addGeoJsonFeature(_activeLayer, clipped);
        _activeLayer.getSource().removeFeature(paddockFeature);
    }
    function _clipFarm(featureToClip, farmSource) {
        var farmFeatures = farmSource.getFeatures(), clipped = _erase(featureToClip, farmFeatures);
        _addGeoJsonFeature(_activeLayer, clipped);
        _merge(farmSource.getFeatures());
    }
    function _area(features) {
        $log.info("calculating area of features ...", features);
        var geoJsonFeatures = _featuresToGeoJson(features);
        return turf.area(geoJsonFeatures) * 1e-4;
    }
    function _remove(features, deselect) {
        if (!_isDefined(deselect)) {
            deselect = true;
        }
        $log.info("removing features ...", features);
        if (_isDefined(features)) {
            features.forEach(function(feature) {
                _activeLayer.getSource().removeFeature(feature);
            });
        }
        if (deselect) {
            _select.interaction.getFeatures().clear();
        }
    }
    function _selectedFeatures() {
        if (!_isDefined(_select) || !_isDefined(_select.interaction)) {
            return;
        }
        $log.info("Selected features ...", _select.interaction.getFeatures());
        return _select.interaction.getFeatures();
    }
    function _enableEditing() {
        if (!-_isDefined(_mode) || _mode === "edit") {
            return;
        }
        $log.info("editing enabled");
        _select.enable();
        _modify.enable();
        _snap.enable();
        _draw.disable();
        _mode = "edit";
    }
    function _enableDrawing() {
        if (!-_isDefined(_mode) || _mode === "draw") {
            return;
        }
        $log.info("drawing enabled");
        _select.disable();
        _modify.disable();
        _draw.enable();
        _snap.enable();
        _mode = "draw";
    }
    function _enableDonutDrawing() {
        if (!-_isDefined(_mode) || _mode === "donut-draw") {
            return;
        }
        $log.info("donut drawing enabled");
        _select.disable();
        _modify.disable();
        _draw.enable();
        _snap.enable();
        _mode = "donut-draw";
    }
    function _isDrawing() {
        if (!-_isDefined(_mode)) {
            return;
        }
        return _draw.isDrawing();
    }
    function _isEditing() {
        if (!-_isDefined(_mode)) {
            return;
        }
        return _select.interaction.getFeatures().getLength() > 0;
    }
    return {
        init: _init,
        destroy: _destroy,
        enableDrawing: _enableDrawing,
        enableEditing: _enableEditing,
        enableDonutDrawing: _enableDonutDrawing,
        merge: _merge,
        remove: _remove,
        clip: _clip,
        area: _area,
        selectedFeatures: _selectedFeatures,
        isDrawing: _isDrawing,
        isEditing: _isEditing
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("modifyInteraction", function(validations, $log) {
    var _isDefined = validations.isDefined;
    function _create(map, select) {
        var modifyInteraction = new ol.interaction.Modify({
            features: select.interaction.getFeatures()
        });
        function _init() {
            $log.info("modify interaction init ...");
            map.addInteraction(modifyInteraction);
            modifyInteraction.setActive(false);
        }
        function _enable() {
            modifyInteraction.setActive(true);
        }
        function _disable() {
            modifyInteraction.setActive(false);
        }
        return {
            init: _init,
            enable: _enable,
            disable: _disable,
            interaction: modifyInteraction
        };
    }
    return {
        create: _create
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("selectInteraction", function(validations, $log) {
    var _isDefined = validations.isDefined;
    function _create(map, layer) {
        var selectInteraction = new ol.interaction.Select({
            addCondition: ol.events.condition.shiftKeyOnly,
            layers: [ layer ]
        });
        function _init() {
            $log.info("select interaction init ...");
            map.addInteraction(selectInteraction);
            selectInteraction.setActive(false);
        }
        function _enable() {
            selectInteraction.setActive(true);
        }
        function _disable() {
            selectInteraction.setActive(false);
        }
        return {
            init: _init,
            enable: _enable,
            disable: _disable,
            interaction: selectInteraction
        };
    }
    return {
        create: _create
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("snapInteraction", function(validations, $log) {
    var _isDefined = validations.isDefined;
    function _create(map, farmSource, paddocksSource) {
        var snapInteraction = new ol.interaction.Snap({
            source: paddocksSource
        });
        snapInteraction.addFeature(farmSource.getFeatures()[0]);
        function _enable() {
            snapInteraction.setActive(true);
        }
        function _disable() {
            snapInteraction.setActive(false);
        }
        function _init() {
            $log.info("snap interaction init ...");
            map.addInteraction(snapInteraction);
            snapInteraction.setActive(false);
        }
        return {
            init: _init,
            enable: _enable,
            disable: _disable,
            interaction: snapInteraction
        };
    }
    return {
        create: _create
    };
});

"use strict";

angular.module("farmbuild.webmapping").run(function(webmapping) {});

angular.injector([ "ng", "farmbuild.webmapping" ]);