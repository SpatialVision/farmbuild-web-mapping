/**
 * @since 0.0.1
 * @copyright 2015 State of Victoria.

 * @author State of Victoria
 * @version 1.0.0
 */

'use strict';

/**
 * webmapping actions namespace
 * @memberof webmapping
 * @type {object}
 * @namespace webmapping.actions
 */

angular.module('farmbuild.webmapping')
	.factory('webMappingInteractions',
	function (validations,
	          $log,
	          webMappingSelectInteraction,
	          webMappingModifyInteraction,
	          webMappingDrawInteraction,
	          webMappingSnapInteraction,
	          webMappingGeoProcessing,
	          $rootScope) {
		var _isDefined = validations.isDefined,
			_select, _modify, _draw, _snap, _activeLayer, _activeLayerName,
			_mode,
			_farmLayerGroup, _farmLayer, _paddocksLayer, _map,
			_transform = webMappingGeoProcessing,
			_farmName,
			_donutContainer;
		var unBindWebMappingMeasureStart;
		var unBindWebMappingMeasureEnd;
		var unBindWebMappingBeforeDrawEnd;
		var unBindWebMappingDonutDrawEnd;

		/**
		 * Remove all the webmapping interactions, this only remove the interactions which is added by webmapping to ol.Map
		 * @memberof webmapping.actions
		 * @param {!ol.Map} map - openlayers map object
		 * @method destroy
		 */
		function _destroy(map) {
			$log.info('destroying all interactions ...');
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
		};

		/**
		 * Initialise mapping actions
		 * @memberof webmapping.actions
		 * @method init
		 * @param {!ol.Map} map - openlayers map object
		 * @param {!ol.layer.Group} farmLayerGroup - farm LayerGroup, use olHelper class to get this object
		 * @param {!String} activeLayerName - can be "paddocks" or "farm", the layer which you want to interact with
		 * @param {Boolean} snappingDefaultStatus - whether to activate snapping, snapping is used between farm, paddocks and rural parcels
		 * @param {Boolean} initKeyboardInteraction - whether to activate keyboard interaction
		 * @param {Boolean} enableMultiSelect - whether to activate multi select for paddocks
		 */
		function _init(map, farmLayerGroup, activeLayerName, snappingDefaultStatus, initKeyboardInteraction, enableMultiSelect) {

			$log.info('interactions init ...');
			if (!_isDefined(activeLayerName) || !_isDefined(map) || !_isDefined(farmLayerGroup)) {
				return;
			}

			_farmLayerGroup = farmLayerGroup;
			_farmLayer = farmLayerGroup.getLayers().item(1);
			_paddocksLayer = farmLayerGroup.getLayers().item(0);
			_map = map;

			if (activeLayerName === 'paddocks') {
				_activeLayer = _paddocksLayer;

			} else if (activeLayerName === 'farm') {
				_activeLayer = _farmLayer;
				_farmName = _activeLayer.getSource().getFeatures()[0].getProperties().name;
			} else {
				return;
			}

			_select = webMappingSelectInteraction.create(map, _activeLayer, enableMultiSelect);
			_modify = webMappingModifyInteraction.create(map, _select);
			_draw = webMappingDrawInteraction.create(map);
			_snap = webMappingSnapInteraction.create(map, _farmLayer.getSource(), _paddocksLayer.getSource());
			_mode = '';
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
		};

		function _addEventListeners() {
			unBindWebMappingMeasureStart = $rootScope.$on('web-mapping-measure-start', function (event, data) {
                if (!_isDefined(_select) || !_isDefined(_modify) || !_isDefined(_draw)) {
                    return;
                }
                _select.disable();
                _modify.disable();
                _draw.disable();
                _mode = 'measure';
            });

            unBindWebMappingMeasureEnd = $rootScope.$on('web-mapping-measure-end', function (event, data) {
                if (!_isDefined(_select) || !_isDefined(_modify) || !_isDefined(_draw)) {
                    return;
                }
                _select.enable();
                _modify.enable();
                _draw.disable();
                _mode = 'edit';
            });

            unBindWebMappingBeforeDrawEnd = $rootScope.$on('web-mapping-before-draw-end', function (event, feature) {
                $log.info('draw end ...');
                var clipped = _clip(feature, _farmLayerGroup);
                $rootScope.$broadcast('web-mapping-draw-end', clipped);
            });

            unBindWebMappingDonutDrawEnd = $rootScope.$on('web-mapping-donut-draw-end', function (event, feature) {
                $log.info('donut draw end ...');
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
				if (_activeLayerName === 'farm') {
					properties.name = _farmName;
				} else {
					properties.name = 'Paddock ' + (new Date()).getTime();
				}
			}
			properties.geometry = feature.getProperties().geometry;
			feature.setProperties(properties);
			$log.info('adding feature ...', feature);
			layer.getSource().addFeature(feature);
			_clearSelections();
			return feature;
		};

		/**
		 * Clips the selected feature, paddcoks are clipped by other paddocks and farm.
		 * @memberof webmapping.actions.features
		 * @method remove
		 * @param {ol.Collection.<ol.Feature>} features feature you want to remove
		 * @param {Boolean} deselect whether to clear selections after they are removed
		 */
		function _remove(features, deselect) {
			if (!_isDefined(features) || !_isDefined(_activeLayer)) {
				return;
			}
			if (!_isDefined(deselect)) {
				deselect = true;
			}
			$log.info('removing features ...', features);
			features.forEach(function (feature) {
				try {
					_activeLayer.getSource().removeFeature(feature);
				} catch (e) {
					$log.error(e);
				}
			});
			if (deselect) {
				_clearSelections()
			}
		};

		/**
		 * Clips the selected feature, selected paddock is clipped by other paddocks and farm boundary.
		 * @memberof webmapping.actions.features
		 * @method clip
		 * @param {!ol.Feature} featureToClip feature you want to clip
		 * @param {!ol.layer.Group} farmLayers the groupLayer of farm, use olHelper class to get this
		 * @returns {ol.Feature} Clipped feature
		 */
		function _clip(featureToClip, farmLayers) {
			if (!_isDefined(farmLayers) || !_isDefined(farmLayers.getLayers()) || !_isDefined(featureToClip) || !_isDefined(farmLayers.getLayers().item(0)) || !_isDefined(farmLayers.getLayers().item(1))) {
				return;
			}
			$log.info('clipping feature ...', featureToClip);
			var paddockSource = farmLayers.getLayers().item(0).getSource(),
				farmSource = farmLayers.getLayers().item(1).getSource();

			if (_activeLayerName === 'paddocks' && (_mode === 'draw' || _mode === 'edit')) {
				return _clipPaddocks(featureToClip, paddockSource, farmSource);
			}

			if (_activeLayerName === 'farm') {
				return _clipFarm(featureToClip, farmSource)

			}
		};

		function _clipPaddocks(featureToClip, paddockSource, farmSource) {
			var properties = featureToClip.getProperties(),
				paddocksFeatures, farmFeatures, clipped;
			if (farmSource.getFeatures()[0].getGeometry().getExtent()[0] === Infinity) {
				$log.error('please draw farm boundaries before adding paddock');
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

			if (clipped && clipped.getGeometry().getType() === 'GeometryCollection') {
				var temp = [];
				clipped.getGeometry().getGeometries().forEach(function (f) {
					if (f.getType() !== 'LineString' && f.getType() !== 'Point') {
						temp.push(new ol.Feature({
							geometry: new ol.geom.Polygon(f.getCoordinates())
						}))
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
		};

		function _clipFarm(featureToClip, farmSource) {
			var clipped = featureToClip,
				properties, result;
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
		};

		/**
		 * Selected features by select interaction
		 * @memberof webmapping.actions.features
		 * @method selections
		 * @returns {ol.Collection.<ol.Feature>} Collection of ol.Features, represents selected features
		 */
		function _selectedFeatures() {
			if (!_isDefined(_select) || !_isDefined(_select.interaction)) {
				return;
			}
			$log.info('Selected features ...', _select.interaction.getFeatures());
			return _select.interaction.getFeatures();
		};

		function _enableEditing() {
			if (!_isDefined(_mode) || _mode === 'edit' || _mode === 'measure') {
				return;
			}
			$log.info('editing enabled');
			_mode = 'edit';
			_select.disable();
			_modify.enable();
			_draw.disable();
		};

		function _disableEditing() {
			if (!_isDefined(_mode) && _mode === 'edit') {
				return;
			}
			$log.info('editing disabled');
			_mode = 'select';
			_select.enable();
			_modify.disable();
		};

		function _enableDrawing() {
			if (!_isDefined(_mode) || _mode === 'draw' || _mode === 'measure') {
				return;
			}
			$log.info('drawing enabled');
			_mode = 'draw';
			_select.disable();
			_modify.disable();
			_draw.enable(_mode);
		};

		function _disableDrawing() {
			if (!_isDefined(_mode)) {
				return;
			}
			$log.info('drawing disabled');
			_mode = 'select';
			_select.enable();
			_draw.disable();
		};

		function _clearSelections() {
			_select.interaction.getFeatures().clear();
		};

		function _isDrawing() {
			if (!_isDefined(_mode)) {
				return;
			}
			return _draw.isDrawing();
		};

		function _finishDrawing() {
			if (!_isDefined(_mode)) {
				return;
			}
			_draw.finish();
		};

		function _discardDrawing() {
			if (!_isDefined(_mode)) {
				return;
			}
			_draw.discard();
			_selectedFeatures().clear();
		};

		function _disableSnapping() {
			if (!_isDefined(_snap)) {
				return;
			}
			return _snap.disable();
		};

		function _isSnappingActive() {
			if (!_isDefined(_snap)) {
				return;
			}
			return _snap.interaction.getActive();
		};

		function _enableSnapping() {
			if (!_isDefined(_snap)) {
				return;
			}
			return _snap.enable();
		};

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

			element.addEventListener('keydown', onKeyDown);

		};

		return {
			init: _init,
			destroy: _destroy,
			/**
			 * Editing namespace of webmapping.actions
			 * @memberof webmapping.actions
			 * @type {object}
			 * @namespace webmapping.actions.editing
			 */
			editing: {
				/**
				 * Enables webmapping edit mode
				 * @memberof webmapping.actions.editing
				 * @method enable
				 */
				enable: _enableEditing,
				/**
				 * Disables webmapping edit mode
				 * @memberof webmapping.actions.editing
				 * @method enable
				 */
				disable: _disableEditing
			},
			/**
			 * Drawing namespace of webmapping.actions
			 * @memberof webmapping.actions
			 * @type {object}
			 * @namespace webmapping.actions.drawing
			 */
			drawing: {
				/**
				 * Discard drawing if it is in progress
				 * @memberof webmapping.actions.drawing
				 * @method discard
				 */
				discard: _discardDrawing,
				/**
				 * Finish drawing if it is in progress, this require drawing at least to have two point to draw a polygon
				 * @memberof webmapping.actions.drawing
				 * @method finish
				 */
				finish: _finishDrawing,
				/**
				 * Enables webmapping draw mode
				 * @memberof webmapping.actions.drawing
				 * @method enable
				 */
				enable: _enableDrawing,
				/**
				 * Disable webmapping draw mode
				 * @memberof webmapping.actions.drawing
				 * @method disable
				 */
				disable: _disableDrawing
			},
			/**
			 * Snapping namespace of webmapping.actions
			 * @memberof webmapping.actions
			 * @type {object}
			 * @namespace webmapping.actions.snapping
			 */
			snapping: {
				/**
				 * Enables webmapping snap interaction
				 * @memberof webmapping.actions.snapping
				 * @method enable
				 */
				enable: _enableSnapping,
				/**
				 * Disable webmapping snap interaction
				 * @memberof webmapping.actions.snapping
				 * @method disable
				 */
				disable: _disableSnapping,
				/**
				 * Is webmapping snap interaction active?
				 * @memberof webmapping.actions.snapping
				 * @method active
				 * @returns {boolean} whether snap interaction is active
				 */
				active: _isSnappingActive
			},
			/**
			 * Features namespace of webmapping.actions
			 * @memberof webmapping.actions
			 * @type {object}
			 * @namespace webmapping.actions.features
			 */
			features: {
				selections: _selectedFeatures
			}
		}
	});
