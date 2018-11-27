'use strict';

/**
 * webmapping openlayers helper
 * @type {object}
 * @namespace webmapping.olHelper
 */

angular.module('farmbuild.webmapping')
    .factory('webMappingOpenLayersHelper',
    function (validations,
              webMappingGoogleAddressSearch,
              webMappingTransformation,
              webMappingConverter,
              $log) {
        var _isDefined = validations.isDefined,
            _googleProjection = 'EPSG:3857',
            _ZoomToExtentControl,
            _transform = webMappingTransformation,
            _converter = webMappingConverter;

        function addControlsToOlMap(map, extent) {
            if (extent) {
                _ZoomToExtentControl = new ol.control.ZoomToExtent({
                    extent: extent
                });
                map.addControl(_ZoomToExtentControl);
            }
            map.addControl(new ol.control.ScaleLine());
        }

        /**
         * initialise webmapping
         * @method init
         * @param {!ol.Map} map openlayers map object
         * @param {!ol.Extent} extent - extent of the farm to initialise the map
         * @memberof webmapping.olHelper
         */
        function _init(map, extent) {
            var defaults = {
                centerNew: [-36.22488327137526, 145.5826132801325],
                zoomNew: 6
            };
            var view = map.getView();
            $log.info('farm extent: %j', extent);

            if (extent[0] === Infinity) {
                view.setCenter(ol.proj.transform([defaults.centerNew[1], defaults.centerNew[0]],
                    'EPSG:4283', _googleProjection));
                view.setZoom(defaults.zoomNew);
            } else {
	            view.fit(extent, map.getSize());
            }
            addControlsToOlMap(map, extent);
        }

        /**
         * Exports farm geometry
         * @method exportGeometry
         * @returns {object} object containing farm and paddocks geometry
         * @param {!ol.source.Vector} source openlayers map object
         * @param {!string} dataProjection - data projection code
         * @memberof webmapping.olHelper
         */
        function _exportGeometry(source, dataProjection) {
            if (!_isDefined(source)) {
                return;
            }
            var format = new ol.format['GeoJSON']();
            try {
                var result = format.writeFeaturesObject(source.getFeatures(), {
                        dataProjection: dataProjection,
                        featureProjection: _googleProjection
                    });
                angular.forEach(result.features, function (feature) {
                    feature.geometry.crs = {
                        properties: {
                            name: dataProjection
                        }
                    }
                });
                return result;
            } catch (e) {
                $log.error(e);
            }
        };

        /**
         * Centers map at the specified coordinates and set zoom to a proper level
         * @method center
         * @param {!ol.Coordinate} coordinates
         * @param {!ol.Map} map object to interact with
         * @memberof webmapping.olHelper
         */
        function _center(coordinates, map) {
            if (!_isDefined(coordinates) || !_isDefined(map)) {
                return;
            }
            $log.info('centring view ...');
            map.getView().setCenter(coordinates);
            map.getView().setZoom(15);
        };

        function _createPaddocksLayer(paddocksGeometry, dataProjection) {
            if (!_isDefined(paddocksGeometry) || !_isDefined(dataProjection)) {
                return;
            }
            $log.info('creating paddocks vector layer ...', dataProjection, _googleProjection);
            var paddocksSource = new ol.source.Vector({
	            wrapX: false,
	            features: (new ol.format.GeoJSON()).readFeatures(paddocksGeometry, {
                    dataProjection: dataProjection,
                    featureProjection: _googleProjection
                })
            });

            return new ol.layer.Vector({
                source: paddocksSource,
                title: 'Paddocks',
                style: new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: '#3399CC',
                        width: 3
                    })
                })
            });
        };

        function _createFarmLayer(farmGeometry, dataProjection) {
            if (!_isDefined(farmGeometry) || !_isDefined(dataProjection)) {
                return;
            }
            $log.info('creating farm vector layer ...', dataProjection, _googleProjection);
            var farmSource = new ol.source.Vector({
	            wrapX: false,
	            features: (new ol.format.GeoJSON()).readFeatures(farmGeometry, {
                    dataProjection: dataProjection,
                    featureProjection: _googleProjection
                })
            });

            return new ol.layer.Vector({
                source: farmSource,
                title: 'Farm',
                style: new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: 'rgba(255, 255, 255, 0)'
                    }),
                    stroke: new ol.style.Stroke({
                        color: '#ff6600',
                        width: 3
                    })
                })
            });
        };

        /**
         * Creates farm layerGroup
         * @method createFarmLayers
         * @returns {ol.layer.Group} object containing farm and paddocks geometry
         * @param {!object} geometry farmGeometry
         * @param {!string} dataProjection - data projection code
         * @param {!string} featureProjection - feature projection code
         * @memberof webmapping.olHelper
         */
        function _createFarmLayers(geometry, dataProjection, featureProjection) {
            return new ol.layer.Group({
                'title': 'Farm layers',
                layers: [
                    _createPaddocksLayer(geometry.paddocks, dataProjection, featureProjection),
                    _createFarmLayer(geometry.farm, dataProjection, featureProjection)
                ]
            })
        }

        /**
         * Reloads the farm layers
         * @method reload
         * @param {!ol.Map} map openlayers map object
         * @param {!object} geoJsons object that containts farm and paddocks geometry to reload from
         * @param {!string} dataProjection - data projection code
         * @memberof webmapping.olHelper
         */
        function _reload(map, geoJsons, dataProjection) {
            var farmLayers = map.getLayers().item(1).getLayers(),
                farmSource = farmLayers.item(1).getSource(),
                paddocksSource = farmLayers.item(0).getSource(),
                farmFeatures = _converter.geoJsonToFeatures(geoJsons.farm, dataProjection, _googleProjection),
                paddockFeatures = _converter.geoJsonToFeatures(geoJsons.paddocks, dataProjection, _googleProjection);
            farmSource.clear();
            paddocksSource.clear();
            farmSource.addFeatures(farmFeatures);
            paddocksSource.addFeatures(paddockFeatures);
        };

        /**
         * Initialises google address search and creates a autocomplete for given text input.
         * @method initGoogleAddressSearch
         * @param {!object} textInputElement Text input dom element which is used to show autocomplete
         * @param {!ol.Map} olmap object to interact with when user chooses a location from autocomplete
         * @memberof webmapping.olHelper
         */
        function _initGoogleAddressSearch(textInputElement, olmap) {
            if (!_isDefined(textInputElement) || !_isDefined(olmap)) {
                return;
            }
            $log.info('init google address search ...', textInputElement);
            function onPlaceChanged(latLng) {
                latLng = _transform.fromGoogleLatLng(latLng);
                _center(latLng, olmap);
            }

            webMappingGoogleAddressSearch.init(textInputElement, onPlaceChanged);
        };

        /**
         * Updates the extent of ZoomToExtent control, call this method after a change to farm boundaries.
         * @method updateExtent
         * @memberof webmapping.olHelper
         */
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
        };

        /**
         * Returns farm layer from passed map
         * @method farmLayer
         * @param {!ol.Map} map object with farm layers and base layers
         * @returns {ol.layer.Vector} farm Layer
         * @memberof webmapping.olHelper
         */
        function _farmLayer(map) {
            if (!_isDefined(map) || !_isDefined(map.getLayers().item(1)) || !_isDefined(map.getLayers().item(1).getLayers() || !_isDefined(map.getLayers().item(1).getLayers().getLength() === 2))) {
                return;
            }
            return map.getLayers().item(1).getLayers().item(1);
        };

        /**
         * Returns paddocks layer from passed map
         * @method paddocksLayer
         * @param {!ol.Map} map object with farm layers and base layers
         * @returns {ol.layer.Vector} paddocks Layer
         * @memberof webmapping.olHelper
         */
        function _paddocksLayer(map) {
            if (!_isDefined(map) || !_isDefined(map.getLayers().item(1)) || !_isDefined(map.getLayers().item(1).getLayers() || !_isDefined(map.getLayers().item(1).getLayers().getLength() === 2))) {
                return;
            }
            return map.getLayers().item(1).getLayers().item(0);
        };

        /**
         * Returns farm layer group from passed map, this group contains farm and paddocks vector layers
         * @method farmLayerGroup
         * @param {!ol.Map} map object with farm layers and base layers
         * @returns {ol.layer.Group} farm Layer Group
         * @memberof webmapping.olHelper
         */
        function _farmLayerGroup(map) {
            if (!_isDefined(map) || !_isDefined(map.getLayers().item(1))) {
                return;
            }
            return map.getLayers().item(1);
        };

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
        }

    });
