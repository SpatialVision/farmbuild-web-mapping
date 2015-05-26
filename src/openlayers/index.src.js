'use strict';

angular.module('farmbuild.webmapping')
    .factory('openLayers',
    function (validations,
              $log) {
        var _isDefined = validations.isDefined;

        function _transform(latLng, sourceProjection, destinationProjection) {
            if(!_isDefined(latLng) || !_isDefined(sourceProjection) || !_isDefined(destinationProjection)){
                return;
            }
            var transformed = ol.proj.transform(latLng, sourceProjection, destinationProjection);
            return new google.maps.LatLng(transformed[1], transformed[0])
        };

        function _exportGeometry(source) {
            if(!_isDefined(source)){
                return;
            }
            var format = new ol.format['GeoJSON']();
            try {
                return format.writeFeatures(source.getFeatures());
            } catch (e) {
                $log.error(e);
            }
        };

        function _clear(farmSource, paddocksSource) {
            if(!_isDefined(farmSource) || !_isDefined(paddocksSource)){
                return;
            }
            $log.info('clearing source ...');
            paddocksSource.clear();
            farmSource.clear();
        };

        function _integrateGMap(gmap, map, dataProjection) {
            if(!_isDefined(gmap) || !_isDefined(map) || !_isDefined(dataProjection)){
                return;
            }
            $log.info('integrating google map ...');
            var view = map.getView(),
                targetElement = map.getTargetElement(),
                googleProjection = 'EPSG:3857';
            view.on('change:center', function () {
                var center = ol.proj.transform(view.getCenter(), googleProjection, dataProjection);
                gmap.setCenter(new google.maps.LatLng(center[1], center[0]));
            });

            view.on('change:resolution', function () {
                gmap.setZoom(view.getZoom());
            });

            // Google Map and vector layers go out of sync when window is resized.
            window.onresize = function () {
                var center = _transform(view.getCenter(), googleProjection, dataProjection);
                google.maps.event.trigger(gmap, "resize");
                gmap.setCenter(center);
            };

            var defaults = {
              centerNew: [-36.22488327137526, 145.5826132801325],
              zoomNew: 6
            }
            var extent = map.getLayers().item(1).getSource().getExtent();

            $log.info('farm extent: %j', extent)

            if (extent[0] === Infinity) {
              gmap.controls[google.maps.ControlPosition.TOP_LEFT].push(targetElement);
              targetElement.parentNode.removeChild(targetElement);
              view.setCenter(ol.proj.transform([defaults.centerNew[1], defaults.centerNew[0]],
                dataProjection, googleProjection));
              view.setZoom(defaults.zoomNew);
              return;
            }

            gmap.controls[google.maps.ControlPosition.TOP_LEFT].push(targetElement);
            targetElement.parentNode.removeChild(targetElement);
            view.fitExtent(extent, map.getSize());
        };

        function _center(coordinates, map) {
            if(!_isDefined(coordinates) || !_isDefined(map)){
                return;
            }
            $log.info('centring view ...');
            map.getView().setCenter(coordinates);
            map.getView().setZoom(15);
        };

        function _paddocksLayer(paddocksGeometry, dataProjection, featureProjection) {
            if(!_isDefined(paddocksGeometry) || !_isDefined(dataProjection) || !_isDefined(featureProjection)){
                return;
            }
            $log.info('creating paddocks vector layer ...', dataProjection, featureProjection);
            var paddocksSource = new ol.source.Vector({
                features: (new ol.format.GeoJSON()).readFeatures(paddocksGeometry, {
                    dataProjection: dataProjection,
                    featureProjection: featureProjection
                })
            });

            return new ol.layer.Vector({
                source: paddocksSource,
                style: new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: 'rgba(255, 255, 255, 0.3)'
                    }),
                    stroke: new ol.style.Stroke({
                        color: '#319FD3',
                        width: 1
                    })
                })
            });
        };

        function _farmLayer(farmGeometry, dataProjection, featureProjection) {
            if(!_isDefined(farmGeometry) || !_isDefined(dataProjection) || !_isDefined(featureProjection)){
                return;
            }
            $log.info('creating farm vector layer ...', dataProjection, featureProjection);
            var farmSource = new ol.source.Vector({
                features: (new ol.format.GeoJSON()).readFeatures(farmGeometry, {
                    dataProjection: dataProjection,
                    featureProjection: featureProjection
                })
            });

            return new ol.layer.Vector({
                source: farmSource,
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

        return {
            exportGeometry: _exportGeometry,
            clear: _clear,
            center: _center,
            integrateGMap: _integrateGMap,
            paddocksLayer: _paddocksLayer,
            farmLayer: _farmLayer
        }

    });