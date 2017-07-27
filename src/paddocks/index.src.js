'use strict';

/**
 * @since 0.0.1
 * @copyright 2015 State of Victoria.
 * @author State of Victoria
 * @version 1.0.0
 */

/**
 * webmapping paddock
 * @type {object}
 * @namespace webmapping.paddocks
 */
angular.module('farmbuild.webmapping')
	.factory('webMappingPaddocks',
	function ($log, validations, farmdata) {
		var _isDefined = validations.isDefined;

		/**
		 * finds a paddock based on the coordinate
		 * @method findByCoordinate
		 * @param {!ol.Coordinate} coordinate openlayers map object
		 * @param {!ol.layer.Vector} vectorLayer - paddock layer
		 * @returns {ol.Feature} the first paddock found in that coordinate
		 * @memberof webmapping.paddocks
		 */
		function _findByCoordinate(coordinate, vectorLayer) {
			var found;
			if (!_isDefined(coordinate) || !_isDefined(vectorLayer)) {
				return;
			}
			var paddocks = vectorLayer.getSource().getFeaturesAtCoordinate(coordinate);
			if (paddocks && paddocks.length > 0) {
				found = vectorLayer.getSource().getFeaturesAtCoordinate(coordinate)[0];
			}
			$log.info('looking up for a paddock at ', coordinate, found);
			return found;
		}

		return {
			findByCoordinate: _findByCoordinate,
			/**
			 * Find paddock by name
			 * @method findByName
			 * @param {!string} name - name of the paddock to search for
			 * @param {!Array} paddocks - paddocks array to search on
			 * @returns {!object} paddock Object
			 * @public
			 * @memberof webmapping.paddocks
			 */
			findByName: farmdata.paddocks.byName,
			/**
			 * Find paddock by id
			 * @method findById
			 * @param {!string} id - id of the paddock to search for
			 * @param {!Array} paddocks - paddocks array to search on
			 * @returns {!object} paddock Object
			 * @public
			 * @memberof webmapping.paddocks
			 */
			findById: farmdata.paddocks.byId,
			/**
			 * Returns GeoJSON for a given paddock
			 * @method toGeoJSON
			 * @param {!object} paddock - paddock object
			 * @returns {object} Paddock Feature Object
			 * @public
			 * @memberof webmapping.paddocks
			 */
			toGeoJSON: farmdata.paddocks.toGeoJSON,

			/**
			 * webmapping paddocks/types
			 * @type {object}
			 * @namespace webmapping.paddocks/types
			 * @memberof webmapping
			 */

			/**
			 * Adds a new Paddock type to farmdata PaddockTypes
			 * @method add
			 * @param {!string} name - name of new type. it must be unique, can only contain alphanumeric values with space or underscore but no other special characters
			 * @returns {object} PaddockTypes collection
			 * @memberof webmapping.paddocks/types
			 * @public
			 * @static
			 */
			/**
			 * Returns the PaddockType at specified index
			 * @method at
			 * @returns {object} PaddockType
			 * @memberof webmapping.paddocks/types
			 * @public
			 * @static
			 */
			/**
			 * Returns PaddockTypes collection as an array
			 * @method toArray
			 * @returns {Array} PaddockTypes
			 * @memberof webmapping.paddocks/types
			 * @public
			 * @static
			 */
			/**
			 * Removes the Paddock type at specified index
			 * @method removeAt
			 * @returns {object} PaddockTypes collection
			 * @memberof webmapping.paddocks/types
			 * @public
			 * @static
			 */
			/**
			 * Loads the types into the PaddockTypes
			 * @method load
			 * @param PaddockTypes
			 * @returns {object} PaddockTypes collection
			 * @memberof webmapping.paddocks/types
			 * @public
			 * @static
			 */
			types: farmdata.paddockTypes,


			/**
			 * webmapping paddocks/groups
			 * @type {object}
			 * @namespace webmapping.paddocks/groups
			 * @memberof webmapping
			 */

			/**
			 * Adds a new Paddock group to farmdata paddockGroups
			 * @method add
			 * @param {!string} name - name of new group. it must be unique, can only contain alphanumeric values with space, underscore or dash but no other special characters
			 * @returns {object} paddockGroups collection
			 * @memberof webmapping.paddocks/groups
			 * @public
			 * @static
			 */
			/**
			 * Returns the PaddockGroup at specified index
			 * @method at
			 * @returns {object} PaddockGroup
			 * @memberof webmapping.paddocks/groups
			 * @public
			 * @static
			 */
			/**
			 * Returns PaddockGroups collection as an array
			 * @method toArray
			 * @returns {Array} PaddockGroups
			 * @memberof webmapping.paddocks/groups
			 * @public
			 * @static
			 */
			/**
			 * Removes the Paddock group at specified index
			 * @method removeAt
			 * @returns {object} PaddockGroups collection
			 * @memberof webmapping.paddocks/groups
			 * @public
			 * @static
			 */
			/**
			 * Loads the groups into PaddockGroups
			 * @method load
			 * @param PaddockGroups
			 * @returns {object} PaddockGroups collection
			 * @memberof webmapping.paddocks/groups
			 * @public
			 * @static
			 */
			groups: farmdata.paddockGroups
		};

	});