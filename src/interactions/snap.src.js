'use strict';

angular.module('farmbuild.webmapping')
	.factory('webMappingSnapInteraction',
	function (validations,
	          $log) {
		var _isDefined = validations.isDefined;

		function _create(map, farmSource, paddocksSource) {

			if(!_isDefined(map) || !_isDefined(farmSource) || !_isDefined(paddocksSource)){
				$log.error('There is a problem with input parameters, please refer to api for more information');
				return;
			}

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

			function _init(active) {
				$log.info('snap interaction init ...');
				map.addInteraction(snapInteraction);
				snapInteraction.setActive(active);
			}

			function _destroy(map) {
				if(!_isDefined(map)){
					$log.error('There is a problem with input parameters, map object is not defined');
					return;
				}
				map.removeInteraction(snapInteraction)
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
		}

	});
