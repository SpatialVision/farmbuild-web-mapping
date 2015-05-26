angular.module('farmbuild.webmapping.examples', ['farmbuild.webmapping'])

	.run(function ($rootScope) {
		$rootScope.appVersion = farmbuild.examples.webmapping.version;
	})

	.controller('MapCtrl',
	function ($scope, $log, $location, webmapping, googleaddresssearch, openLayers, interactions) {

		var dataProjectionCode = 'EPSG:4283',
			featureProjectionCode = 'EPSG:3857',
			dataProjection = ol.proj.get({code: dataProjectionCode}),
			maxZoom = 21,
			defaults = {
				centerNew: [-36.22488327137526, 145.5826132801325],
				zoomNew: 6
			},
			layerSelectionElement = document.getElementById('layers'),
			gmapElement = document.getElementById('gmap'),
			gmap = new google.maps.Map(gmapElement, {
				disableDefaultUI: true,
				keyboardShortcuts: false,
				draggable: false,
				disableDoubleClickZoom: true,
				scrollwheel: false,
				streetViewControl: false,
				mapTypeId: google.maps.MapTypeId.SATELLITE
			}),
			farmLayer,
			paddocksLayer;

		$scope.farmData = {};
		$scope.farmChanged = false;
		$scope.noResult = $scope.farmLoaded = false;
		$scope.selectedPaddockName = '';

		$scope.loadFarmData = function () {
			$scope.farmData = webmapping.find();

			var geoJsons = webmapping.toGeoJsons($scope.farmData);

			if (!angular.isDefined(geoJsons)) {
				$scope.noResult = true;
				return;
			}

			farmLayer = openLayers.farmLayer(geoJsons.farm, dataProjectionCode, featureProjectionCode),
				paddocksLayer = openLayers.paddocksLayer(geoJsons.paddocks, dataProjectionCode, featureProjectionCode);

			var map = new ol.Map({
				layers: [paddocksLayer, farmLayer],
				target: 'olmap',
				keyboardEventTarget: gmapElement,
				view: new ol.View({
					rotation: 0,
					projection: dataProjection,
					maxZoom: maxZoom
				}),
				interactions: ol.interaction.defaults({
					altShiftDragRotate: false,
					dragPan: false,
					rotate: false,
					mouseWheelZoom: true
				}).extend([new ol.interaction.DragPan({kinetic: null})]),
				controls: ol.control.defaults({
					attributionOptions: /** @type {olx.control.AttributionOptions} */ ({
						collapsible: false
					})
				}).extend([
					new ol.control.ZoomToExtent({
						extent: farmLayer.getSource().getExtent()
					}),
					new ol.control.ScaleLine()
				])
			});

			openLayers.integrateGMap(gmap, map, dataProjectionCode);

			googleaddresssearch.init('locationautocomplete', dataProjectionCode);

			$scope.farmLoaded = true;

			//webmapping.ga.track('AgSmart');


			map.on('pointermove', function (event) {
				var layer;
				if (layerSelectionElement.value === 'none' || layerSelectionElement.value === '') {
					return;
				}
				if (layerSelectionElement.value === "paddocks") {
					layer = paddocksLayer;
				}
				if (layerSelectionElement.value === "farm") {
					layer = farmLayer;
				}
				if (layer.getSource().getFeaturesAtCoordinate(event.coordinate).length > 0 && !interactions.isDrawing()) {
					interactions.enableEditing();
				}
				if (layer.getSource().getFeaturesAtCoordinate(event.coordinate).length === 0 && !interactions.isEditing()) {
					interactions.enableDrawing();
				}
			});

			map.on('dblclick', function (event) {
				if (paddocksLayer.getSource().getFeaturesAtCoordinate(event.coordinate).length > 0 && interactions.isEditing()) {
					interactions.enableDonutDrawing();
				}
			});

			map.on('click', function (event) {
				if (paddocksLayer.getSource().getFeaturesAtCoordinate(event.coordinate).length > 0) {
					$scope.selectedPaddockName = paddocksLayer.getSource().getFeaturesAtCoordinate(event.coordinate)[0].getProperties().name;
					$scope.$apply();
					$log.info('Paddock selected: ' + $scope.selectedPaddockName);
				}
			});

			//Deselect all selections when layer is changed from farm to paddocks.
			layerSelectionElement.addEventListener('change', function () {
				interactions.destroy(map);
				interactions.init(map, farmLayer, paddocksLayer, layerSelectionElement.value);
			});

		};

		$scope.loadFarmData();

		$scope.exportFarmData = function (farmData) {
			webmapping.export(document, farmData);
		};

		$scope.clear = function () {
			$scope.farmData ={};
			webmapping.session.clear();
			location.href = '../index.html'
		}

		$scope.apply = function () {
			$log.info('apply...');
			$scope.saveToSessionStorage('farmData', angular.toJson($scope.farmData));
			$scope.farmChanged = false;
		};

		$scope.removeSelectedPaddocks = function () {
			$log.info('removing selected paddock(s)...');
			var selectedPaddocks = interactions.selected();
			interactions.remove(selectedPaddocks);
			$scope.farmChanged = false;
		};

		$scope.clipSelectedPaddock = function () {
			$log.info('Clipping selected paddock...');
			var selectedPaddock = interactions.selected().item(0);
			if (interactions.selected().getLength() === 1) {
				paddocksLayer.getSource().removeFeature(selectedPaddock);
				interactions.clip(selectedPaddock, paddocksLayer.getSource(), farmLayer.getSource());
			}
			$scope.farmChanged = false;
		};

		$scope.mergeSelectedPaddocks = function () {
			$log.info('Merging selected paddocks...');
			var selectedPaddock = interactions.selected().item(0);
			if (interactions.selected().getLength() > 1) {
				paddocksLayer.getSource().removeFeature(selectedPaddock);
				interactions.clip(selectedPaddock, paddocksLayer.getSource(), farmLayer.getSource());
			}
			$scope.farmChanged = false;
		};

		$scope.cancel = function () {
			$log.info('cancel...');
			$scope.farmData = findInSessionStorage();
			$scope.farmChanged = false;
		};

		gmapElement.addEventListener('keydown', function (event) {
			var selectedFeatures = interactions.selected();
			if (event.keyCode == 46 || event.keyCode == 8) {
				$scope.removeSelectedPaddocks();
				event.preventDefault();
				event.stopPropagation();
			}

			if (event.keyCode == 13) {
				if (selectedFeatures.getLength() > 1) {
					$scope.mergeSelectedPaddocks();
				}
				if (selectedFeatures.getLength() === 1) {
					$scope.clipSelectedPaddock();
				}
			}

		});

	});
