"use strict";

angular.module("farmbuild.webmapping", [ "farmbuild.core", "farmbuild.farmdata" ]).factory("webmapping", function(farmdata, $log, $rootScope, farmdataConverter, webMappingSession, webMappingProjections, webMappingInteractions, webMappingMeasurement, webMappingPaddocks, webMappingOpenLayersHelper) {
    $log.info("Welcome to Web Mapping...");
    var session = webMappingSession, webMapping = {
        session: session,
        farmdata: farmdata,
        toGeoJsons: farmdataConverter.toGeoJsons,
        actions: webMappingInteractions,
        paddocks: webMappingPaddocks,
        olHelper: webMappingOpenLayersHelper,
        measurement: webMappingMeasurement,
        load: session.load,
        find: session.find,
        save: function(geoJsons) {
            var farmData = session.find();
            return session.save(farmData, geoJsons);
        },
        create: farmdata.create,
        on: function(name, listener) {
            return $rootScope.$on(name, listener);
        }
    };
    webMapping.version = "2.4.1";
    if (typeof window.farmbuild === "undefined") {
        window.farmbuild = {
            webmapping: webMapping
        };
    } else {
        window.farmbuild.webmapping = webMapping;
    }
    return webMapping;
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingConverter", function(validations, $log) {
    var _isDefined = validations.isDefined, _geoJSONFormat = new ol.format["GeoJSON"]();
    function _openLayerFeatureToGeoJson(olFeature, dataProjection, featureProjection) {
        if (!_isDefined(olFeature)) {
            return;
        }
        $log.info("Converting openlayer feature to geoJson ...", olFeature);
        return _geoJSONFormat.writeFeatureObject(olFeature, {
            dataProjection: dataProjection,
            featureProjection: featureProjection
        });
    }
    function _openLayerFeaturesToGeoJson(olFeatures, dataProjection, featureProjection) {
        if (!_isDefined(olFeatures)) {
            return;
        }
        $log.info("Converting openlayer feature to geoJson ...", olFeatures);
        return _geoJSONFormat.writeFeaturesObject(olFeatures, {
            dataProjection: dataProjection,
            featureProjection: featureProjection
        });
    }
    function _geoJsonToOpenLayerFeature(feature, dataProjection, featureProjection) {
        if (!_isDefined(feature)) {
            return;
        }
        $log.info("Converting geoJson feature to openlayer feature ...", feature);
        return _geoJSONFormat.readFeature(feature, {
            dataProjection: dataProjection,
            featureProjection: featureProjection
        });
    }
    function _geoJsonToOpenLayerFeatures(features, dataProjection, featureProjection) {
        if (!_isDefined(features)) {
            return;
        }
        $log.info("Converting geoJson feature to openlayer features ...", features);
        return _geoJSONFormat.readFeatures(features, {
            dataProjection: dataProjection,
            featureProjection: featureProjection
        });
    }
    return {
        featureToGeoJson: _openLayerFeatureToGeoJson,
        featuresToGeoJson: _openLayerFeaturesToGeoJson,
        geoJsonToFeature: _geoJsonToOpenLayerFeature,
        geoJsonToFeatures: _geoJsonToOpenLayerFeatures
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingGeoProcessing", function(validations, webMappingConverter, $log) {
    var _isDefined = validations.isDefined, converter = webMappingConverter;
    function _eraseAll(clipee, clippers) {
        if (!_isDefined(clipee) || !_isDefined(clippers)) {
            return;
        }
        $log.info("erasing feature", clipee);
        var clipeeGeoJson = converter.featureToGeoJson(clipee);
        clippers.forEach(function(clipper) {
            var clipperGeoJson = converter.featureToGeoJson(clipper);
            try {
                clipeeGeoJson = turf.erase(clipeeGeoJson, clipperGeoJson);
            } catch (e) {
                $log.warn("This operation is not supported,", e);
            }
        });
        return converter.geoJsonToFeature(clipeeGeoJson);
    }
    function _erase(clipee, clipper) {
        if (!_isDefined(clipee) || !_isDefined(clipper)) {
            return;
        }
        $log.info("erasing feature 2 from 1", clipee, clipper);
        var clipeeGeoJson = converter.featureToGeoJson(clipee), cliperGeoJson = converter.featureToGeoJson(clipper), clipped;
        try {
            clipped = turf.erase(clipeeGeoJson, cliperGeoJson);
            return converter.geoJsonToFeature(clipped);
        } catch (e) {
            $log.warn("This operation is not supported,", e);
        }
    }
    function _intersect(olFeature1, olFeature2) {
        $log.info("intersecting feature", olFeature1, olFeature2);
        var feature1 = converter.featureToGeoJson(olFeature1), feature2 = converter.featureToGeoJson(olFeature2), intersection;
        try {
            intersection = turf.intersect(feature1, feature2);
            return converter.geoJsonToFeature(intersection);
        } catch (e) {
            $log.warn("This operation is not supported,", e);
        }
    }
    function _merge(olFeatures) {
        $log.info("merging features ...", olFeatures);
        var properties, toMerge;
        toMerge = converter.featuresToGeoJson(olFeatures);
        properties = {
            name: "merged " + new Date().getTime()
        };
        try {
            return converter.geoJsonToFeature(turf.merge(toMerge), properties);
        } catch (e) {
            $log.warn("This operation is not supported,", e);
        }
    }
    return {
        eraseAll: _eraseAll,
        erase: _erase,
        intersect: _intersect,
        merge: _merge
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingDrawInteraction", function(validations, $log, $rootScope) {
    var _mode;
    function _create(map) {
        var drawInteraction = new ol.interaction.Draw({
            source: new ol.source.Vector(),
            type: "Polygon"
        }), drawingStatus = false;
        function _init() {
            $log.info("draw interaction init ...");
            map.addInteraction(drawInteraction);
            drawInteraction.setActive(false);
            drawInteraction.on("drawend", function(e) {
                drawingStatus = false;
                if (_mode === "draw") {
                    $rootScope.$broadcast("web-mapping-before-draw-end", e.feature);
                }
                if (_mode === "donut-draw") {
                    $rootScope.$broadcast("web-mapping-donut-draw-end", e.feature);
                }
            });
            drawInteraction.on("drawstart", function(event) {
                $log.info("draw start ...");
                $rootScope.$broadcast("web-mapping-draw-start", event.feature);
                drawingStatus = true;
            });
        }
        function _enable(mode) {
            _mode = mode;
            drawInteraction.setActive(true);
        }
        function _disable() {
            drawInteraction.setActive(false);
        }
        function _finish() {
            drawInteraction.finishDrawing();
        }
        function _isDrawing() {
            return drawingStatus;
        }
        function _discard() {
            drawingStatus = false;
            _disable();
            _enable(_mode);
        }
        return {
            init: _init,
            enable: _enable,
            disable: _disable,
            interaction: drawInteraction,
            isDrawing: _isDrawing,
            finish: _finish,
            discard: _discard
        };
    }
    return {
        create: _create
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingInteractions", function(validations, $log, webMappingSelectInteraction, webMappingModifyInteraction, webMappingDrawInteraction, webMappingSnapInteraction, webMappingGeoProcessing, $rootScope) {
    var _isDefined = validations.isDefined, _select, _modify, _draw, _snap, _activeLayer, _activeLayerName, _mode, _farmLayerGroup, _farmLayer, _paddocksLayer, _map, _transform = webMappingGeoProcessing, _farmName, _donutContainer;
    var unBindWebMappingMeasureStart;
    var unBindWebMappingMeasureEnd;
    var unBindWebMappingBeforeDrawEnd;
    var unBindWebMappingDonutDrawEnd;
    function _destroy(map) {
        $log.info("destroying all interactions ...");
        if (!_isDefined(_select) || !_isDefined(_modify) || !_isDefined(_snap) || !_isDefined(_draw)) {
            return;
        }
        map.removeInteraction(_select.interaction);
        map.removeInteraction(_modify.interaction);
        map.removeInteraction(_draw.interaction);
        _snap.destroy(map);
        _select = undefined;
        _modify = undefined;
        _draw = undefined;
        _snap = undefined;
        _activeLayer = undefined;
        _activeLayerName = undefined;
        _mode = undefined;
        unBindWebMappingMeasureStart();
        unBindWebMappingMeasureEnd();
        unBindWebMappingDonutDrawEnd();
        unBindWebMappingBeforeDrawEnd();
    }
    function _init(map, farmLayerGroup, activeLayerName, snappingDefaultStatus, initKeyboardInteraction, enableMultiSelect) {
        $log.info("interactions init ...");
        if (!_isDefined(activeLayerName) || !_isDefined(map) || !_isDefined(farmLayerGroup)) {
            return;
        }
        _farmLayerGroup = farmLayerGroup;
        _farmLayer = farmLayerGroup.getLayers().item(1);
        _paddocksLayer = farmLayerGroup.getLayers().item(0);
        _map = map;
        if (activeLayerName === "paddocks") {
            _activeLayer = _paddocksLayer;
        } else if (activeLayerName === "farm") {
            _activeLayer = _farmLayer;
            _farmName = _activeLayer.getSource().getFeatures()[0].getProperties().name;
        } else {
            return;
        }
        _select = webMappingSelectInteraction.create(map, _activeLayer, enableMultiSelect);
        _modify = webMappingModifyInteraction.create(map, _select);
        _draw = webMappingDrawInteraction.create(map);
        _snap = webMappingSnapInteraction.create(map, _farmLayer.getSource(), _paddocksLayer.getSource());
        _mode = "";
        _activeLayerName = activeLayerName;
        _select.init();
        _select.enable();
        _modify.init();
        _draw.init();
        _snap.init(snappingDefaultStatus);
        if (initKeyboardInteraction) {
            _enableKeyboardShortcuts();
        }
        _addEventListeners();
    }
    function _addEventListeners() {
        unBindWebMappingMeasureStart = $rootScope.$on("web-mapping-measure-start", function(event, data) {
            if (!_isDefined(_select) || !_isDefined(_modify) || !_isDefined(_draw)) {
                return;
            }
            _select.disable();
            _modify.disable();
            _draw.disable();
            _mode = "measure";
        });
        unBindWebMappingMeasureEnd = $rootScope.$on("web-mapping-measure-end", function(event, data) {
            if (!_isDefined(_select) || !_isDefined(_modify) || !_isDefined(_draw)) {
                return;
            }
            _select.enable();
            _modify.enable();
            _draw.disable();
            _mode = "edit";
        });
        unBindWebMappingBeforeDrawEnd = $rootScope.$on("web-mapping-before-draw-end", function(event, feature) {
            $log.info("draw end ...");
            var clipped = _clip(feature, _farmLayerGroup);
            $rootScope.$broadcast("web-mapping-draw-end", clipped);
        });
        unBindWebMappingDonutDrawEnd = $rootScope.$on("web-mapping-donut-draw-end", function(event, feature) {
            $log.info("donut draw end ...");
            _select.interaction.getFeatures().push(_clip(feature, _farmLayerGroup));
            _donutContainer = null;
        });
    }
    function _addFeature(layer, feature, newProperties) {
        var properties = newProperties || {};
        if (!_isDefined(feature)) {
            return;
        }
        if (!_isDefined(properties.name)) {
            if (_activeLayerName === "farm") {
                properties.name = _farmName;
            } else {
                properties.name = "Paddock " + new Date().getTime();
            }
        }
        properties.geometry = feature.getProperties().geometry;
        feature.setProperties(properties);
        $log.info("adding feature ...", feature);
        layer.getSource().addFeature(feature);
        _clearSelections();
        return feature;
    }
    function _remove(features, deselect) {
        if (!_isDefined(features) || !_isDefined(_activeLayer)) {
            return;
        }
        if (!_isDefined(deselect)) {
            deselect = true;
        }
        $log.info("removing features ...", features);
        features.forEach(function(feature) {
            try {
                _activeLayer.getSource().removeFeature(feature);
            } catch (e) {
                $log.error(e);
            }
        });
        if (deselect) {
            _clearSelections();
        }
    }
    function _clip(featureToClip, farmLayers) {
        if (!_isDefined(farmLayers) || !_isDefined(farmLayers.getLayers()) || !_isDefined(featureToClip) || !_isDefined(farmLayers.getLayers().item(0)) || !_isDefined(farmLayers.getLayers().item(1))) {
            return;
        }
        $log.info("clipping feature ...", featureToClip);
        var paddockSource = farmLayers.getLayers().item(0).getSource(), farmSource = farmLayers.getLayers().item(1).getSource();
        if (_activeLayerName === "paddocks" && (_mode === "draw" || _mode === "edit")) {
            return _clipPaddocks(featureToClip, paddockSource, farmSource);
        }
        if (_activeLayerName === "farm") {
            return _clipFarm(featureToClip, farmSource);
        }
    }
    function _clipPaddocks(featureToClip, paddockSource, farmSource) {
        var properties = featureToClip.getProperties(), paddocksFeatures, farmFeatures, clipped;
        if (farmSource.getFeatures()[0].getGeometry().getExtent()[0] === Infinity) {
            $log.error("please draw farm boundaries before adding paddock");
            return;
        }
        if (_isDefined(properties.name)) {
            paddockSource.removeFeature(featureToClip);
        }
        paddocksFeatures = paddockSource.getFeatures();
        farmFeatures = farmSource.getFeatures();
        properties = featureToClip.getProperties();
        clipped = _transform.eraseAll(featureToClip, paddocksFeatures);
        clipped = _transform.intersect(clipped, farmFeatures[0]);
        if (clipped && clipped.getGeometry().getType() === "GeometryCollection") {
            var temp = [];
            clipped.getGeometry().getGeometries().forEach(function(f) {
                if (f.getType() !== "LineString" && f.getType() !== "Point") {
                    temp.push(new ol.Feature({
                        geometry: new ol.geom.Polygon(f.getCoordinates())
                    }));
                }
            });
            var merged = _transform.merge(temp);
            merged.setProperties({
                name: clipped.getProperties().name,
                id: clipped.getProperties().id
            });
            clipped = merged;
        }
        return _addFeature(_activeLayer, clipped, properties);
    }
    function _clipFarm(featureToClip, farmSource) {
        var clipped = featureToClip, properties, result;
        if (farmSource.getFeatures()[0]) {
            properties = farmSource.getFeatures()[0].getProperties();
        }
        if (farmSource.getFeatures()[0] && farmSource.getFeatures()[0].getGeometry().getExtent()[0] !== Infinity) {
            clipped = _transform.erase(featureToClip, farmSource.getFeatures()[0]);
            _addFeature(_activeLayer, clipped, properties);
            clipped = _transform.merge(farmSource.getFeatures());
        }
        _remove(farmSource.getFeatures(), false);
        result = _addFeature(_activeLayer, clipped, properties);
        _clearSelections();
        return result;
    }
    function _selectedFeatures() {
        if (!_isDefined(_select) || !_isDefined(_select.interaction)) {
            return;
        }
        $log.info("Selected features ...", _select.interaction.getFeatures());
        return _select.interaction.getFeatures();
    }
    function _enableEditing() {
        if (!_isDefined(_mode) || _mode === "edit" || _mode === "measure") {
            return;
        }
        $log.info("editing enabled");
        _mode = "edit";
        _select.disable();
        _modify.enable();
        _draw.disable();
    }
    function _disableEditing() {
        if (!_isDefined(_mode) && _mode === "edit") {
            return;
        }
        $log.info("editing disabled");
        _mode = "select";
        _select.enable();
        _modify.disable();
    }
    function _enableDrawing() {
        if (!_isDefined(_mode) || _mode === "draw" || _mode === "measure") {
            return;
        }
        $log.info("drawing enabled");
        _mode = "draw";
        _select.disable();
        _modify.disable();
        _draw.enable(_mode);
    }
    function _disableDrawing() {
        if (!_isDefined(_mode)) {
            return;
        }
        $log.info("drawing disabled");
        _mode = "select";
        _select.enable();
        _draw.disable();
    }
    function _clearSelections() {
        _select.interaction.getFeatures().clear();
    }
    function _isDrawing() {
        if (!_isDefined(_mode)) {
            return;
        }
        return _draw.isDrawing();
    }
    function _finishDrawing() {
        if (!_isDefined(_mode)) {
            return;
        }
        _draw.finish();
    }
    function _discardDrawing() {
        if (!_isDefined(_mode)) {
            return;
        }
        _draw.discard();
        _selectedFeatures().clear();
    }
    function _disableSnapping() {
        if (!_isDefined(_snap)) {
            return;
        }
        return _snap.disable();
    }
    function _isSnappingActive() {
        if (!_isDefined(_snap)) {
            return;
        }
        return _snap.interaction.getActive();
    }
    function _enableSnapping() {
        if (!_isDefined(_snap)) {
            return;
        }
        return _snap.enable();
    }
    function _enableKeyboardShortcuts() {
        var element = _map.getTargetElement();
        element.tabIndex = 0;
        function onKeyDown(event) {
            var selectedFeatures = _selectedFeatures();
            if (!_isDefined(selectedFeatures)) {
                return;
            }
            if (event.keyCode == 46 || event.keyCode == 8) {
                _remove(selectedFeatures);
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
            if (event.keyCode == 13) {
                if (_isDrawing()) {
                    _finishDrawing();
                } else {
                    _clip(_selectedFeatures().item(0), _farmLayerGroup);
                }
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
            if (event.keyCode == 27) {
                if (_isDrawing()) {
                    _discardDrawing();
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }
            }
        }
        element.addEventListener("keydown", onKeyDown);
    }
    return {
        init: _init,
        destroy: _destroy,
        editing: {
            enable: _enableEditing,
            disable: _disableEditing
        },
        drawing: {
            discard: _discardDrawing,
            finish: _finishDrawing,
            enable: _enableDrawing,
            disable: _disableDrawing
        },
        snapping: {
            enable: _enableSnapping,
            disable: _disableSnapping,
            active: _isSnappingActive
        },
        features: {
            selections: _selectedFeatures
        }
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingModifyInteraction", function(validations, $log) {
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

angular.module("farmbuild.webmapping").factory("webMappingSelectInteraction", function(validations, $rootScope, $log) {
    var _isDefined = validations.isDefined;
    function _create(map, layer, multi) {
        if (!_isDefined(multi)) {
            multi = false;
        }
        var selectConfig = {
            multi: multi,
            layers: [ layer ]
        };
        if (multi) {
            selectConfig.addCondition = ol.events.condition.shiftKeyOnly;
        } else {
            selectConfig.addCondition = ol.events.condition.never;
            selectConfig.toggleCondition = ol.events.condition.never;
        }
        var width = 3;
        selectConfig.style = [ new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: "white",
                width: width + 2
            })
        }), new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: "#ff6600",
                width: width
            })
        }) ];
        var selectInteraction = new ol.interaction.Select(selectConfig);
        function _init() {
            $log.info("select interaction init ...");
            map.addInteraction(selectInteraction);
            selectInteraction.setActive(false);
            selectInteraction.getFeatures().on("change:length", function() {
                var selections = selectInteraction.getFeatures();
                if (!selectConfig.multi && selections.getLength() > 0) {
                    $rootScope.$broadcast("web-mapping-feature-select", selectInteraction.getFeatures().item(0));
                    return;
                }
                if (selectConfig.multi && selections.getLength() > 0) {
                    $rootScope.$broadcast("web-mapping-feature-select", selectInteraction.getFeatures().getArray());
                    return;
                }
                $rootScope.$broadcast("web-mapping-feature-deselect");
            });
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

angular.module("farmbuild.webmapping").factory("webMappingSnapInteraction", function(validations, $log) {
    var _isDefined = validations.isDefined;
    function _create(map, farmSource, paddocksSource) {
        if (!_isDefined(map) || !_isDefined(farmSource) || !_isDefined(paddocksSource)) {
            $log.error("There is a problem with input parameters, please refer to api for more information");
            return;
        }
        var snapInteraction = new ol.interaction.Snap({
            source: paddocksSource
        }), snapVisibleLayer;
        snapInteraction.addFeature(farmSource.getFeatures()[0]);
        function _enable() {
            snapInteraction.setActive(true);
        }
        function _disable() {
            snapInteraction.setActive(false);
        }
        function _init(active) {
            $log.info("snap interaction init ...");
            map.addInteraction(snapInteraction);
            snapInteraction.setActive(active);
        }
        function _destroy(map) {
            if (!_isDefined(map)) {
                $log.error("There is a problem with input parameters, map object is not defined");
                return;
            }
            map.removeInteraction(snapInteraction);
        }
        return {
            init: _init,
            enable: _enable,
            disable: _disable,
            interaction: snapInteraction,
            destroy: _destroy
        };
    }
    return {
        create: _create
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingMeasurement", function(validations, webMappingConverter, $log) {
    var _isDefined = validations.isDefined, _googleProjection = "EPSG:3857", _openlayersDefaultProjection = "EPSG:4326", _converter = webMappingConverter;
    function _areas(features) {
        $log.info("calculating area of features ...", features);
        try {
            return turf.area(features) * 1e-4;
        } catch (e) {
            $log.error(e);
        }
    }
    function _area(feature) {
        $log.info("calculating area of polygon ...", feature);
        feature = _converter.featureToGeoJson(feature, _openlayersDefaultProjection, _googleProjection);
        try {
            return turf.area(feature) * 1e-4;
        } catch (e) {
            $log.error(e);
        }
    }
    function _length(feature) {
        $log.info("calculating length of line ...", feature);
        feature = _converter.featureToGeoJson(feature, _openlayersDefaultProjection, _googleProjection);
        try {
            return turf.lineDistance(feature, "kilometers") * 1e3;
        } catch (e) {
            $log.error(e);
        }
    }
    return {
        area: _area,
        areas: _areas,
        length: _length
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingOpenLayersHelper", function(validations, webMappingGoogleAddressSearch, webMappingTransformation, webMappingConverter, $log) {
    var _isDefined = validations.isDefined, _googleProjection = "EPSG:3857", _ZoomToExtentControl, _transform = webMappingTransformation, _converter = webMappingConverter;
    function addControlsToOlMap(map, extent) {
        if (extent) {
            _ZoomToExtentControl = new ol.control.ZoomToExtent({
                extent: extent
            });
            map.addControl(_ZoomToExtentControl);
        }
        map.addControl(new ol.control.ScaleLine());
    }
    function _init(map, extent) {
        var defaults = {
            centerNew: [ -36.22488327137526, 145.5826132801325 ],
            zoomNew: 6
        };
        var view = map.getView();
        $log.info("farm extent: %j", extent);
        if (extent[0] === Infinity) {
            view.setCenter(ol.proj.transform([ defaults.centerNew[1], defaults.centerNew[0] ], "EPSG:4283", _googleProjection));
            view.setZoom(defaults.zoomNew);
        } else {
            view.fit(extent, map.getSize());
        }
        addControlsToOlMap(map, extent);
    }
    function _exportGeometry(source, dataProjection) {
        if (!_isDefined(source)) {
            return;
        }
        var format = new ol.format["GeoJSON"]();
        try {
            var result = format.writeFeaturesObject(source.getFeatures(), {
                dataProjection: dataProjection,
                featureProjection: _googleProjection
            });
            angular.forEach(result.features, function(feature) {
                feature.geometry.crs = {
                    properties: {
                        name: dataProjection
                    }
                };
            });
            return result;
        } catch (e) {
            $log.error(e);
        }
    }
    function _createPaddocksLayer(paddocksGeometry, dataProjection) {
        if (!_isDefined(paddocksGeometry) || !_isDefined(dataProjection)) {
            return;
        }
        $log.info("creating paddocks vector layer ...", dataProjection, _googleProjection);
        var paddocksSource = new ol.source.Vector({
            wrapX: false,
            features: new ol.format.GeoJSON().readFeatures(paddocksGeometry, {
                dataProjection: dataProjection,
                featureProjection: _googleProjection
            })
        });
        return new ol.layer.Vector({
            source: paddocksSource,
            title: "Paddocks",
            style: new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: "#3399CC",
                    width: 3
                })
            })
        });
    }
    function _createFarmLayer(farmGeometry, dataProjection) {
        if (!_isDefined(farmGeometry) || !_isDefined(dataProjection)) {
            return;
        }
        $log.info("creating farm vector layer ...", dataProjection, _googleProjection);
        var farmSource = new ol.source.Vector({
            wrapX: false,
            features: new ol.format.GeoJSON().readFeatures(farmGeometry, {
                dataProjection: dataProjection,
                featureProjection: _googleProjection
            })
        });
        return new ol.layer.Vector({
            source: farmSource,
            title: "Farm",
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
    function _createFarmLayers(geometry, dataProjection, featureProjection) {
        return new ol.layer.Group({
            title: "Farm layers",
            layers: [ _createPaddocksLayer(geometry.paddocks, dataProjection, featureProjection), _createFarmLayer(geometry.farm, dataProjection, featureProjection) ]
        });
    }
    function _reload(map, geoJsons, dataProjection) {
        var farmLayers = map.getLayers().item(1).getLayers(), farmSource = farmLayers.item(1).getSource(), paddocksSource = farmLayers.item(0).getSource(), farmFeatures = _converter.geoJsonToFeatures(geoJsons.farm, dataProjection, _googleProjection), paddockFeatures = _converter.geoJsonToFeatures(geoJsons.paddocks, dataProjection, _googleProjection);
        farmSource.clear();
        paddocksSource.clear();
        farmSource.addFeatures(farmFeatures);
        paddocksSource.addFeatures(paddockFeatures);
    }
    function _initGoogleAddressSearch(textInputElement, olmap) {
        if (!_isDefined(textInputElement) || !_isDefined(olmap)) {
            return;
        }
        $log.info("init google address search ...", textInputElement);
        function onPlaceChanged(latLng) {
            latLng = _transform.fromGoogleLatLng(latLng);
            _center(latLng, olmap);
        }
        webMappingGoogleAddressSearch.init(textInputElement, onPlaceChanged);
    }
    function _updateZoomToExtent(extent) {
        var map;
        if (!_isDefined(_ZoomToExtentControl)) {
            return;
        }
        map = _ZoomToExtentControl.getMap();
        map.removeControl(_ZoomToExtentControl);
        _ZoomToExtentControl = new ol.control.ZoomToExtent({
            extent: extent
        });
        map.addControl(_ZoomToExtentControl);
    }
    function _farmLayer(map) {
        if (!_isDefined(map) || !_isDefined(map.getLayers().item(1)) || !_isDefined(map.getLayers().item(1).getLayers() || !_isDefined(map.getLayers().item(1).getLayers().getLength() === 2))) {
            return;
        }
        return map.getLayers().item(1).getLayers().item(1);
    }
    function _paddocksLayer(map) {
        if (!_isDefined(map) || !_isDefined(map.getLayers().item(1)) || !_isDefined(map.getLayers().item(1).getLayers() || !_isDefined(map.getLayers().item(1).getLayers().getLength() === 2))) {
            return;
        }
        return map.getLayers().item(1).getLayers().item(0);
    }
    function _farmLayerGroup(map) {
        if (!_isDefined(map) || !_isDefined(map.getLayers().item(1))) {
            return;
        }
        return map.getLayers().item(1);
    }
    return {
        init: _init,
        exportGeometry: _exportGeometry,
        createFarmLayers: _createFarmLayers,
        farmLayer: _farmLayer,
        paddocksLayer: _paddocksLayer,
        farmLayerGroup: _farmLayerGroup,
        reload: _reload,
        initGoogleAddressSearch: _initGoogleAddressSearch,
        updateExtent: _updateZoomToExtent
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingPaddocks", function($log, validations, farmdata) {
    var _isDefined = validations.isDefined;
    function _findByCoordinate(coordinate, vectorLayer) {
        var found;
        if (!_isDefined(coordinate) || !_isDefined(vectorLayer)) {
            return;
        }
        var paddocks = vectorLayer.getSource().getFeaturesAtCoordinate(coordinate);
        if (paddocks && paddocks.length > 0) {
            found = vectorLayer.getSource().getFeaturesAtCoordinate(coordinate)[0];
        }
        $log.info("looking up for a paddock at ", coordinate, found);
        return found;
    }
    return {
        findByCoordinate: _findByCoordinate,
        findByName: farmdata.paddocks.byName,
        findById: farmdata.paddocks.byId,
        toGeoJSON: farmdata.paddocks.toGeoJSON,
        types: farmdata.paddockTypes,
        groups: farmdata.paddockGroups
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingParcels", function($log, $http, validations, webMappingInteractions, webMappingConverter) {
    var _isDefined = validations.isDefined, converter = webMappingConverter;
    function _load(serviceUrl, extent, extentDataProjection, responseProjection) {
        var config = {
            params: {
                service: "WFS",
                version: "1.0.0",
                request: "GetFeature",
                typeName: "farmbuild:ruralparcels",
                outputFormat: "text/javascript",
                format_options: "callback:JSON_CALLBACK",
                srsname: responseProjection,
                bbox: extent.join(",") + "," + extentDataProjection
            }
        };
        if (!_isDefined(serviceUrl) || !_isDefined(extent) || !_isDefined(extentDataProjection) || !_isDefined(responseProjection)) {
            $log.error("There is a problem with input parameters, please refer to api for more information");
            return;
        }
        $log.info("Loading parcels information for the extent: ", extent);
        return $http({
            method: "JSONP",
            url: serviceUrl,
            params: config.params
        }).success(function(data, status) {
            $log.info("loaded parcels successfully.", status, data);
            var olFeatures = converter.geoJsonToFeatures({
                type: "FeatureCollection",
                features: data.features
            });
            webMappingInteractions.parcels.snap(olFeatures);
        }).error(function(data, status) {
            $log.error("loading parcels failed!!", status, data);
        });
    }
    return {
        load: _load
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingProjections", function($log, farmdata) {
    var webMappingProjections = {
        supported: farmbuild.farmdata.crsSupported
    };
    farmdata.crsSupported.forEach(function(crs) {
        proj4.defs(crs.name, crs.projection);
    });
    return webMappingProjections;
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingSession", function($log, farmdata, validations, webMappingMeasurement, webMappingConverter) {
    var webMappingSession = {}, _isEmpty = validations.isEmpty, _isDefined = validations.isDefined;
    var defaultConfigs = {
        printUrl: "https://farmbuild-mapprint-stg.agriculture.vic.gov.au/getmap"
    };
    if (_isEmpty(sessionStorage.webMappingConfigs)) {
        sessionStorage.webMappingConfigs = JSON.stringify(defaultConfigs);
    }
    function load(farmData) {
        var loaded = farmdata.load(farmData);
        if (!_isDefined(loaded)) {
            return undefined;
        }
        return farmData;
    }
    webMappingSession.load = load;
    function areas(farmData, geoJsons) {
        var _googleProjection = "EPSG:3857", _openlayersDefaultProjection = "EPSG:4326", featureForArea;
        featureForArea = webMappingConverter.geoJsonToFeatures(geoJsons.farm, farmData.geometry.crs, _googleProjection);
        featureForArea = webMappingConverter.featuresToGeoJson(featureForArea, _openlayersDefaultProjection, _googleProjection);
        farmData.area = webMappingMeasurement.areas(featureForArea);
        angular.forEach(geoJsons.paddocks.features, function(p, idx) {
            var _featureForArea;
            _featureForArea = webMappingConverter.geoJsonToFeatures(p, p.geometry.crs.properties.name, _googleProjection);
            _featureForArea = webMappingConverter.featuresToGeoJson(_featureForArea, _openlayersDefaultProjection, _googleProjection);
            p.properties.area = webMappingMeasurement.areas(_featureForArea);
            p.properties.areaUnit = "hectare";
        });
        return farmData;
    }
    function save(farmData, geoJsons) {
        if (!_isDefined(farmData)) {
            $log.error("Unable to save the undefined farmData!");
            return undefined;
        }
        farmData = areas(farmData, geoJsons);
        farmData.name = geoJsons.farm.features[0].properties.name;
        $log.info("new geoJson", geoJsons);
        return farmdata.merge(farmData, geoJsons);
    }
    webMappingSession.save = save;
    webMappingSession.find = function() {
        return farmdata.session.find();
    };
    webMappingSession.update = farmdata.update;
    return webMappingSession;
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingTransformation", function(validations, $log) {
    var _isDefined = validations.isDefined, _openLayersDefaultProjection = "EPSG:4326", _googleProjection = "EPSG:3857";
    function _transformToGoogleLatLng(latLng, destinationProjection) {
        if (!_isDefined(latLng) || !_isDefined(destinationProjection)) {
            return;
        }
        var transformed = ol.proj.transform(latLng, _googleProjection, destinationProjection);
        return new google.maps.LatLng(transformed[1], transformed[0]);
    }
    function _transformFromGoogleLatLng(latLng) {
        if (!_isDefined(latLng)) {
            return;
        }
        return ol.proj.transform([ latLng.lng(), latLng.lat() ], _openLayersDefaultProjection, _googleProjection);
    }
    return {
        fromGoogleLatLng: _transformFromGoogleLatLng,
        toGoogleLatLng: _transformToGoogleLatLng
    };
});

"use strict";

angular.module("farmbuild.webmapping").factory("webMappingGoogleAddressSearch", function(validations, $log) {
    var countryRestrict = {
        country: "au"
    }, _isDefined = validations.isDefined;
    function _init(targetElementId, onPlaceChangedCallback) {
        if (!_isDefined(google) || !_isDefined(google.maps) || !_isDefined(google.maps.places)) {
            $log.error("google.maps.places is not defined, please make sure that you have included google places library in your html page.");
            return;
        }
        if (!_isDefined(targetElementId) || !_isDefined(onPlaceChangedCallback)) {
            return;
        }
        var autocomplete = new google.maps.places.Autocomplete(document.getElementById(targetElementId), {
            componentRestrictions: countryRestrict
        });
        google.maps.event.addListener(autocomplete, "place_changed", function() {
            _onPlaceChanged(autocomplete, onPlaceChangedCallback);
        });
    }
    function _onPlaceChanged(autocomplete, onPlaceChangedCallback) {
        var place = autocomplete.getPlace(), latLng;
        if (!place.geometry) {
            return;
        }
        latLng = place.geometry.location;
        if (_isDefined(onPlaceChangedCallback) && typeof onPlaceChangedCallback === "function") {
            onPlaceChangedCallback(latLng);
        }
    }
    return {
        init: _init
    };
});

"use strict";

angular.module("farmbuild.webmapping").run(function(webmapping) {});

angular.injector([ "ng", "farmbuild.webmapping" ]);