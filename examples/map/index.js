'use strict';

angular.module('farmbuild.webmapping.examples', ['farmbuild.webmapping'])

	.run(function ($rootScope) {
		$rootScope.appVersion = farmbuild.examples.webmapping.version;
	})

	.controller('MapCtrl',
	function ($scope, $log, $location, $rootScope, $filter, webmapping) {

		var dataProjection,

			/**  This example is using Web Mercator: EPSG:3857 to display data on google map */
			featureProjection = 'EPSG:3857',

			maxZoom = 19,
			googleMapElement = document.getElementById('gmap'),
			googleMap,
			olMap,
			actions = webmapping.actions,
			measurement = webmapping.measurement,
			parcels = webmapping.parcels,
			olHelper = webmapping.olHelper,
			paddocks = webmapping.paddocks;

		$scope.measuredValue = 0;
		$scope.farmData = {};
		$scope.farmChanged = false;
		$scope.paddockChanged = false;
		$scope.noResult = $scope.farmLoaded = false;
		$scope.selectedLayer = '';
		$scope.selectedPaddock = {
			name: '',
			type: '',
			comment: '',
			group: ''
		};
		$scope.donutDrawing = false;

		function loadParcels() {
			var parcelsServiceUrl = 'https://farmbuild-wfs-stg.agriculture.vic.gov.au/geoserver/farmbuild/wfs',
				parcelsExtent, extentProjection, responseProjection;

			/**
			 * in this example we use the same projection for extent data and response,
			 * but they can be different based on your application setting.
			 */
			extentProjection = responseProjection = featureProjection;

			if ($scope.selectedLayer === '' || olMap.getView().getZoom() < 14) {
				return;
			}
			parcelsExtent = olMap.getView().calculateExtent(olMap.getSize());
			parcels.load(parcelsServiceUrl, parcelsExtent, extentProjection, responseProjection);
		}

		/**  Create google map object, customise the map object as you like. */
		function createGoogleMap(type) {
			return new google.maps.Map(googleMapElement, {
				disableDefaultUI: true,
				keyboardShortcuts: false,
				draggable: false,
				disableDoubleClickZoom: true,
				scrollwheel: false,
				streetViewControl: false,
				mapTypeId: type
			})
		}

		/** Create openlayers map object, customise the map object as you like. */
		function createOpenLayerMap(geoJsons) {

			/** it is recommended to use these helper functions to create your farm and paddocks layers
			 If you are using olHelper.createBaseLayers(), use olHelper.init() to initialise webmapping
			 If you are using olHelper.createBaseLayersWithGoogleMaps(), use olHelper.initWithGoogleMap() to initialise webmapping
			 */
			var farmLayers = olHelper.createFarmLayers(geoJsons, dataProjection),
			//baseLayers = olHelper.createBaseLayers();
				baseLayers = olHelper.createBaseLayersWithGoogleMaps();

			return new ol.Map({
				layers: [baseLayers, farmLayers],
				target: 'olmap',
				keyboardEventTarget: googleMapElement,
				view: new ol.View({
					rotation: 0,
					maxZoom: maxZoom
				}),
				interactions: ol.interaction.defaults({
					altShiftDragRotate: false,
					dragPan: false,
					rotate: false,
					mouseWheelZoom: true
				}).extend([new ol.interaction.DragPan()])
			})
		}

		function mapOnPointerMove(event) {

			/** don't do anything if user is dragging */
			if (event.dragging) {
				return;
			}

			var selectedLayer = $scope.selectedLayer, coordinate = event.coordinate,
				featureAtCoordinate;
			if (selectedLayer === "paddocks") {
				selectedLayer = olHelper.paddocksLayer(olMap);
			}
			if (selectedLayer === "farm") {
				selectedLayer = olHelper.farmLayer(olMap);
			}
			featureAtCoordinate = webmapping.paddocks.findByCoordinate(coordinate, selectedLayer);
			if (featureAtCoordinate && !actions.drawing.isDrawing()) {
				actions.editing.enable();
			}
			if (!featureAtCoordinate && !actions.editing.isEditing()) {
				actions.drawing.enable();
			}
		}

		function updateNgScope() {
			if (!$scope.$$phase) {
				$scope.$apply();
			}
		}

		function paddockChanged() {
			$scope.paddockChanged = true;
			updateNgScope();
		}

		$scope.onPaddockDetailsChanged = function () {
			var sp = $scope.selectedPaddock;
			actions.features.selections().item(0).setProperties({
				type: sp.type,
				name: sp.name,
				comment: sp.comment,
				area: sp.area,
				group: sp.group
			});
			paddockChanged();
		};

		function farmChanged() {
			$scope.farmChanged = true;
			updateNgScope();
		}

		$scope.onFarmNameChanged = function () {
			if($scope.selectedLayer !== 'farm'){
				$scope.noResult = 'Select farm from edit layers drop down, to edit farm details!';
				return;
			}
			olHelper.farmLayer(olMap).getSource().getFeatures()[0].setProperties({
				name: $scope.farmData.name
			});
			farmChanged();
		};

		function onPaddockSelect(event, selectedPaddock) {
			if ($scope.paddockChanged) {
				$scope.cancel();
			}
			$scope.selectedPaddock = selectedPaddock.getProperties();

			if($scope.selectedPaddock.group) {
				$scope.selectedPaddock.group = function () {
					var result;
					angular.forEach($scope.paddockGroups, function (group) {
						if (group.name === $scope.selectedPaddock.group.name) {
							result = group;
						}
					});
					return result;
				}();
			}

			if($scope.selectedPaddock.type) {
				$scope.selectedPaddock.type = function () {
					var result;
					angular.forEach($scope.paddockTypes, function (group) {
						if (group.name === $scope.selectedPaddock.type.name) {
							result = group;
						}
					});
					return result;
				}();
			}

			$scope.selectedPaddock.area = measurement.area(selectedPaddock);
			$log.info('Paddock selected: ' + $scope.selectedPaddock.name);
			updateNgScope();
		};

		function onPaddockDeselect(event) {
			$scope.selectedPaddock = {};
			updateNgScope();
		};

		$scope.selectLayer = function () {
			var activateSnapping = true,
				activateKeyboardInteractions = true,
				farmLayerGroup = olHelper.farmLayerGroup(olMap),
				farmLayer = olHelper.farmLayer(olMap),
				paddocksLayer = olHelper.paddocksLayer(olMap),
				selectedLayer = $scope.selectedLayer;
			if (angular.isDefined(actions.snapping.active())) {
				activateSnapping = actions.snapping.active();
			}
			$scope.cancel();
			actions.destroy(olMap);
			$scope.selectedPaddock = {};
			if ($scope.selectedLayer === '') {
				olMap.un('pointermove', mapOnPointerMove);
				return;
			}
			actions.init(olMap, farmLayerGroup, selectedLayer, activateSnapping, activateKeyboardInteractions);
			olMap.on('pointermove', mapOnPointerMove);
			farmLayer.getSource().on('changefeature', farmChanged);
			paddocksLayer.getSource().on('changefeature', paddockChanged);
			loadParcels();
		};

		function clipSelectedFeature() {
			$log.info('Clipping selected paddock...');
			var selectedPaddock = actions.features.selections().item(0);
			actions.features.clip(selectedPaddock, olHelper.farmLayerGroup(olMap));
		};

		$scope.exportFarmData = function (farmData) {
			var paddocksGeometry = olHelper.exportGeometry(olHelper.paddocksLayer(olMap).getSource(), dataProjection),
				farmGeometry = olHelper.exportGeometry(olHelper.farmLayer(olMap).getSource(), dataProjection);
			webmapping.export(document, farmData, {paddocks: paddocksGeometry, farm: farmGeometry});
		};

		$scope.clear = function () {
			$scope.farmData = {};
			webmapping.session.clear();
			location.href = '../index.html'
		};

		$scope.apply = function () {
			$log.info('apply changes to farm data ...');
			if (actions.drawing.isDrawing()) {
				actions.drawing.finish();
			} else {
				clipSelectedFeature();
			}
			var farmSource = olHelper.farmLayer(olMap).getSource(),
				paddocksSource = olHelper.paddocksLayer(olMap).getSource(),
				paddocksGeometry = olHelper.exportGeometry(paddocksSource, dataProjection),
				farmGeometry = olHelper.exportGeometry(farmSource, dataProjection);

			if (farmGeometry.features.length === 0) {
				$scope.noResult = 'Farm boundary is invalid, farm boundary should contain all paddocks';
				return;
			}
			webmapping.save({paddocks: paddocksGeometry, farm: farmGeometry});
			$scope.farmData = webmapping.find();
			olHelper.updateExtent(olMap);

			var geoJsons = webmapping.toGeoJsons($scope.farmData);
			if (!angular.isDefined(geoJsons)) {
				$scope.noResult = 'Farm data is invalid';
				return;
			}
			olHelper.reload(olMap, geoJsons, dataProjection);

			$scope.farmChanged = false;
			$scope.paddockChanged = false;
			$scope.selectedPaddock = {};
		};

		$scope.removeSelectedPaddock = function () {
			$log.info('removing selected paddock(s)...');
			var selectedPaddocks = actions.features.selections();
			actions.features.remove(selectedPaddocks);
			$scope.paddockChanged = false;
			$scope.selectedPaddock = {};
			farmChanged();
		};

		$scope.removeFarm = function () {
			$log.info('removing farm...');
			var farmFeature = olHelper.farmLayer(olMap).getSource().getFeatures();
			actions.features.remove(farmFeature);
			farmChanged();
		};

		$scope.cancel = function () {
			$log.info('cancel...');
			$scope.farmData = webmapping.find();
			var geoJsons = webmapping.toGeoJsons($scope.farmData);
			if (!angular.isDefined(geoJsons)) {
				$scope.noResult = 'Farm data is invalid';
				return;
			}
			olHelper.reload(olMap, geoJsons, dataProjection);
			if (actions.features.selections()) {
				actions.features.selections().clear();
			}
			$scope.farmChanged = false;
			$scope.paddockChanged = false;
		};

		$scope.enableDonutDrawing = function () {
			actions.donut.enable();
			olMap.un('pointermove', mapOnPointerMove);
			$scope.donutDrawing = true;
		};

		$scope.disableDonutDrawing = function () {
			olMap.on('pointermove', mapOnPointerMove);
			$scope.donutDrawing = false;
			paddockChanged();
		};

		webmapping.on('web-mapping-draw-end', function () {
			$scope.farmChanged = true;
			farmChanged();
		});

		webmapping.on('web-mapping-donut-draw-end', function () {
			$scope.disableDonutDrawing();
		});

		webmapping.on('web-mapping-measure-end', function (event, data) {
			$scope.measuredValue = data.value;
			$scope.measuredUnit = data.unit;
			updateNgScope();
		});

		webmapping.on('web-mapping-base-layer-change', function (event, data) {
			if (data.layer.getProperties().title === 'Google Street') {
				googleMapElement.firstChild.firstChild.style.display = 'block';
				googleMap.setMapTypeId(google.maps.MapTypeId.ROADMAP);
				return;
			}
			if (data.layer.getProperties().title === 'Google Imagery') {
				googleMapElement.firstChild.firstChild.style.display = 'block';
				googleMap.setMapTypeId(google.maps.MapTypeId.SATELLITE);
				return;
			}
			if (data.layer.getProperties().title.indexOf('VicMAP') > -1) {
				googleMapElement.firstChild.firstChild.style.display = 'none';
				return;
			}
		});

		webmapping.on('web-mapping-feature-select', function (event, data) {
			var selectedLayer = $scope.selectedLayer;
			if (selectedLayer === 'paddocks') {
				onPaddockSelect(event, data)
			}
		});

		webmapping.on('web-mapping-feature-deselect', function (event, data) {
			var selectedLayer = $scope.selectedLayer;
			if (selectedLayer === 'paddocks') {
				onPaddockDeselect(event, data)
			}
		});

		$scope.toGeoJson = function () {
			farmbuild.webmapping.exportGeoJson(document, $scope.farmData);
		};

		$scope.toKml = function () {
			farmbuild.webmapping.exportKml(document, $scope.farmData);
		};

		/**
		* If you want to use api to add custom paddock types this the way to to so
		*/
		function addCustomPaddockTypes(farmData){
			var name = 'New Custom Type using api';
			if(!webmapping.paddocks.types.byName(name)) {
				webmapping.paddocks.types.add(name);
				webmapping.update(farmData);
			}
		}

		/**
		 * If you want to use api to add custom paddock groups this the way to to so
		 */
		function addCustomPaddockGroups(farmData){
			var name = 'New Custom Group using api';
			if(!webmapping.paddocks.groups.byName(name)) {
				webmapping.paddocks.groups.add(name);
				webmapping.update(farmData);
			}
		}

		$scope.loadFarmData = function () {
			var geoJsons;

			$scope.farmData = webmapping.find();
			addCustomPaddockTypes($scope.farmData);
			addCustomPaddockGroups($scope.farmData);
			$scope.paddockTypes = webmapping.paddocks.types.toArray();
			$scope.paddockGroups = webmapping.paddocks.groups.toArray();

			/** Convert geometry data of farmData to valid geoJson */
			geoJsons = webmapping.toGeoJsons($scope.farmData);

			if (!angular.isDefined(geoJsons)) {
				$scope.noResult = 'Farm data is invalid';
				return;
			}

			dataProjection = $scope.farmData.geometry.crs;

			/** Create openlayers map object, customise the map object as you like. */
			olMap = createOpenLayerMap(geoJsons);
			var extent = olHelper.farmLayer(olMap).getSource().getExtent(),
				openlayersMapEl = olMap.getTargetElement();


			/**  Create google map object, customise the map object as you like. */
			googleMap = createGoogleMap(google.maps.MapTypeId.SATELLITE);

			/** Openlayers 3 does not support google maps as a tile layer,
			 so we need to keep openlayers map view and google maps in sync,
			 this helper function does the job for you.
			 If you want to init with google map, you need to use olHelper.createBaseLayersWithGoogleMaps()
			 If you want to init without google map, you need to use olHelper.createBaseLayers()
			 */
			olHelper.initWithGoogleMap(olMap, extent, googleMap, openlayersMapEl);
			//olHelper.init(olMap, extent);

			/** Enable address google search for your map */
			olHelper.initGoogleAddressSearch('locationAutoComplete', olMap);

			/** track api usage by sending statistic to google analytics, this help us to improve service based on usage */
			webmapping.ga.trackWebMapping('farmbuild-test-client');

			/** it is up to you when to load parcels, this example is using map view's change event to load parcels data. Parcels data is used for snapping */
			olMap.getView().on('change:resolution', loadParcels);
			olMap.getView().on('change:center', loadParcels);
			$scope.farmLoaded = true;
		};

		$scope.loadFarmData();

	});
