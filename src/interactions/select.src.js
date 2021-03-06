'use strict';

angular.module('farmbuild.webmapping')
	.factory('webMappingSelectInteraction',
	function (validations,
	          $rootScope,
	          $log) {
		var _isDefined = validations.isDefined;

		function _create(map, layer, multi) {

			if(!_isDefined(multi)){
				multi = false;
			}

			var selectConfig = {
				multi: multi,
				layers: [layer]
			};

			if(multi){
				selectConfig.addCondition = ol.events.condition.shiftKeyOnly
			} else {
				selectConfig.addCondition = ol.events.condition.never;
				selectConfig.toggleCondition = ol.events.condition.never
			}
			
			var width = 3;
			selectConfig.style = [
				new ol.style.Style({
					stroke: new ol.style.Stroke({
						color: 'white',
						width: width + 2
					})
				}),
				new ol.style.Style({
					stroke: new ol.style.Stroke({
						color: '#ff6600',
						width: width
					})
				})
			];

			var selectInteraction = new ol.interaction.Select(selectConfig);

			function _init() {
				$log.info('select interaction init ...');
				map.addInteraction(selectInteraction);
				selectInteraction.setActive(false);
				selectInteraction.getFeatures().on('change:length', function(){
					var selections = selectInteraction.getFeatures();
                    if (!selectConfig.multi && selections.getLength() > 0) {
                        $rootScope.$broadcast("web-mapping-feature-select", selectInteraction.getFeatures().item(0));
                        return;
                    }
                    if (selectConfig.multi && selections.getLength() > 0) {
                        $rootScope.$broadcast("web-mapping-feature-select", selectInteraction.getFeatures().getArray());
                        return;
                    }
					$rootScope.$broadcast('web-mapping-feature-deselect');
				})
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
			}

		};

		return {
			create: _create
		}

	});