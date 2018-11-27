/**
 * @since 0.0.1
 * @copyright 2015 State of Victoria.

 * @author State of Victoria
 * @version 1.0.0
 */

'use strict';

/**
 * webmapping
 * @type {object}
 * @namespace webmapping
 */
angular.module('farmbuild.webmapping', ['farmbuild.core', 'farmbuild.farmdata'])
    .factory('webmapping',
        function (farmdata,
                  $log,
                  $rootScope,
                  farmdataConverter,
                  webMappingSession,
                  webMappingProjections,
                  webMappingInteractions,
                  webMappingMeasurement,
                  webMappingPaddocks,
                  webMappingOpenLayersHelper) {
            $log.info('Welcome to Web Mapping...');

            var session = webMappingSession,
                webMapping = {
                    session: session,
                    farmdata: farmdata,
                    toGeoJsons: farmdataConverter.toGeoJsons,
                    actions: webMappingInteractions,
                    paddocks: webMappingPaddocks,
                    olHelper: webMappingOpenLayersHelper,
                    measurement: webMappingMeasurement,

                    /**
                     * Loads the specified farmData into session
                     * @method load
                     * @returns {object} the farmData stored in session
                     * geoJsons.farm: represents the farm
                     * geoJsonspaddocks: represents the paddocks
                     * @memberof webmapping
                     */
                    load: session.load,

                    /**
                     * Finds the farmData from the session.
                     * @method find
                     * @returns {object} the farmData stored in session, undefined if the farmData is found in session
                     * @memberof webmapping
                     */
                    find: session.find,

                    /**
                     * Saves the specified geoJson into the farmData in the session.
                     * @method save
                     * @returns {object} the farmData stored in session, undefined if the farmData is found in session
                     * @memberof webmapping
                     */
                    save: function (geoJsons) {
                        var farmData = session.find();
                        return session.save(farmData, geoJsons);
                    },

                    /**
                     * Creates a new farmdata block as Javascript object with the specified name.
                     * @method create
                     * @param {!string} name - The name of the farm
                     * @param {string} id - The ID of this farm in case if you manage this farm in an external system, so you can map the farmData
                     * @param {!string} projectionName - The projection name
                     * @param {!Object} options - an object that describes configuration for different sections. Currently you can specify an array for paddockGroups and paddockTypes
                     * with the external system
                     * @returns {Object} the farmdata object, undefined if the required fields are not provided
                     * @memberof webmapping
                     */
                    create: farmdata.create,

                    /**
                     * Listens on events of a given type.
                     * @method on
                     * @param {!string} name Event name to listen on.
                     * @param {!function(event, ...args)} listener - Function to call when the event is emitted.
                     * @returns {function()} Returns a deregistration function for this listener.
                     * @memberof webmapping
                     */
                    on: function (name, listener) {
                        return $rootScope.$on(name, listener);
                    },


                    /**
                     * webmapping events
                     * @type {object}
                     * @namespace webmapping.events
                     */

                    /**
                     * Fires once a active drawing is completed.
                     * Passes the drawn feature to the listener function as the first parameter
                     * @method web-mapping-draw-end
                     * @memberof webmapping.events
                     */

                    /**
                     * Fires once donut drawing is enabled and drawing of the donut polygon is completed.
                     * Passes the drawn feature to the listener function as the first parameter
                     * @method web-mapping-donut-draw-end
                     * @memberof webmapping.events
                     */

                    /**
                     * Fires once a feature(polygon) is selected.
                     * Passes the selected feature to the listener function as the first parameter
                     * @method web-mapping-feature-select
                     * @memberof webmapping.events
                     */

                    /**
                     * Fires once a feature(polygon) is deselected.
                     * Passes the deselected feature to the listener function as the first parameter
                     * @method web-mapping-feature-deselect
                     * @memberof webmapping.events
                     */

                    /**
                     * Fires after measuring is completed.
                     * Passes an object containing value and unit of measurement to the listener function as the first parameter
                     * @method web-mapping-measure-end
                     * @memberof webmapping.events
                     */

                    /**
                     * Fires on base layer change
                     * It passes the selected layer to the listener function as the first parameter
                     * @method web-mapping-base-layer-change
                     * @memberof webmapping.events
                     */
                };

		// Provide a shortcut for modules
		webMapping.version = '2.4.1';

            if (typeof window.farmbuild === 'undefined') {
                window.farmbuild = {
                    webmapping: webMapping
                };
            } else {
                window.farmbuild.webmapping = webMapping;
            }

            return webMapping;

        });
