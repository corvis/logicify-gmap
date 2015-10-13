/**
 * Created by artem on 5/28/15.
 */
(function (angular) {
    'use strict';
    angular.module('LogicifyGMap',[]);
})(angular);
/**
 * Created by artem on 10/12/15.
 */
(function (angular) {
    'use strict';
    angular.module('LogicifyGMap')
        .service('SmartCollection', [function () {
            /**
             * Service is a singleton, so we can use global variable to generate uid!
             */
            var uid = 0;
            /**
             * Redefine isArray method, taken from MDN
             * @param arg
             */
            Array.isArray = function (arg) {
                return Object.prototype.toString.call(arg) === '[object Array]' ||
                        //if it's SmartCollection Class
                    ((arg != null && arg.constructor && arg.constructor.name === 'SmartCollection') &&
                        //and Base Class is Array!
                    Object.prototype.toString.call(arg.__proto__.__proto__) === '[object Array]');
            };

            function SmartCollection(arr) {
                var self = this;
                //private property
                var _iterator = null;
                /**
                 * Iterator changes each time when method 'next' called
                 * If last element reached then iterator resets
                 * @return {ArrayItem || undefined}
                 */
                self['next'] = function () {
                    if (_iterator == null) {
                        _iterator = 0;
                    } else {
                        _iterator++;
                    }
                    if (self[_iterator] !== undefined) {
                        return self[_iterator];
                    }
                    //reset iterator if end of list
                    _iterator = null;
                    return undefined;
                };

                self['setIterator'] = function (index) {
                    if (angular.isNumber(index) && index !== NaN) {
                        if (self[index] === undefined) {
                            throw new Error('Can not reach this element, because it doesn\'t exist. Index: ' + index);
                        } else {
                            _iterator = index;
                        }
                    }
                };
                //init before overriding
                if (Array.isArray(arr)) {
                    arr.forEach(function (item, index) {
                        self.push(item);
                    });
                }
                self._uid = uid++;
                var addCB = [], removeCB = [];
                /**
                 * Override all methods that are changing an array!
                 */
                var push = self.push;
                self['push'] = function () {
                    var args = Array.prototype.slice.call(arguments);
                    var result = push.apply(self, args);
                    args.forEach(function (item) {
                        addCB.forEach(function (callback) {
                            callback.apply(self, [item]);
                        });
                    });
                    return result;
                };
                var pop = self.pop;
                self['pop'] = function () {
                    var args = Array.prototype.slice.call(arguments);
                    var result = pop.apply(self, args);
                    removeCB.forEach(function (callback) {
                        callback.apply(self, [result]);
                    });
                    return result;
                };
                var unshift = self.unshift;
                self['unshift'] = function () {
                    var args = Array.prototype.slice.call(arguments);
                    var result = unshift.apply(self, args);
                    args.forEach(function (item) {
                        addCB.forEach(function (callback) {
                            callback.apply(self, [item]);
                        });
                    });

                    return result;
                };
                var shift = self.shift;
                self['shift'] = function () {
                    var args = Array.prototype.slice.call(arguments);
                    var result = unshift.apply(self, args);
                    removeCB.forEach(function (callback) {
                        callback.apply(self, [result]);
                    });
                    return result;
                };
                var splice = self.splice;
                self['splice'] = function () {
                    var args = Array.prototype.slice.call(arguments);
                    var result = splice.apply(self, args);
                    result.forEach(function (item) {
                        removeCB.forEach(function (callback) {
                            callback.apply(self, [item]);
                        });
                    });

                    return result;
                };
                /**
                 * The same as "splice", but does not call onRemove callback
                 * @return {Array}
                 */
                self['removeQuietly'] = splice;
                self['onRemoveItem'] = function (cb) {
                    if (typeof cb === 'function') {
                        removeCB.push(cb);
                    }
                };
                self['onAddItem'] = function (cb) {
                    if (typeof cb === 'function') {
                        addCB.push(cb);
                    }
                };
            }

            SmartCollection.prototype = Object.create(Array.prototype);
            SmartCollection.prototype.constructor = SmartCollection;
            return SmartCollection;
        }]);
})(angular);
/**
 * Created by artem on 6/24/15.
 */
(function (angular) {
    'use strict';
    /**
     * Note that if you want custom X button for info window you need to add css
     * .gm-style-iw+div{ display:none }
     * where .gm-style-iw is a class of container element, and next div is close button
     */
    angular.module('LogicifyGMap')
        .directive('logicifyGmapControl',
        [
            '$compile',
            '$log',
            '$timeout',
            function ($compile, $log, $timeout) {
                return {
                    restrict: 'E',
                    require: '^logicifyGmap',
                    link: function (scope, iElement, iAttrs, ctrl) {
                        /*global google*/
                        var position = scope.$eval(iAttrs['controlPosition']);
                        var index = scope.$eval(iAttrs['controlIndex']);
                        var events = scope.$eval(iAttrs['events']);
                        var element = angular.element(iElement.html().trim());
                        $compile(element)(scope);
                        $timeout(function () {
                            scope.$apply();
                        });
                        function attachListener(eventName, callback) {
                            google.maps.event.addDomListener(element[0], eventName, function () {
                                var args = arguments;
                                var self = this;
                                //wrap in timeout to run new digest
                                $timeout(function () {
                                    callback.apply(self, args);
                                });
                            });
                        }

                        element[0].index = index || 0;
                        iElement.html('');
                        ctrl.$mapReady(function (map) {
                            if (!map.controls[position]) {
                                throw new Error('Position of control on the map is invalid. Please see google maps spec.');
                            }
                            map.controls[position].push(element[0]);
                            if (events != null) {
                                angular.forEach(events, function (value, key) {
                                    if (typeof value === 'function') {
                                        attachListener(key, value);
                                    }
                                });
                            }
                        });

                    }
                }
            }
        ]);
})(angular);

/**
 * Created by artem on 5/28/15.
 */
(function (angular) {
    'use strict';
    /**
     * Note that if you want custom X button for info window you need to add css
     * .gm-style-iw+div{ display:none }
     * where .gm-style-iw is a class of container element, and next div is close button
     */
    angular.module('LogicifyGMap')
        .directive('logicifyGmap',
        [
            '$compile',
            '$log',
            '$timeout',
            function ($compile, $log, $timeout) {
                return {
                    restrict: 'E',
                    controller: function () {
                        var self = this;
                        var callbackHolders = [];
                        self.$mapReady = function (callback) {
                            if (callback && self.map) {
                                callback(self.map)
                                return;
                            }
                            if (typeof callback === 'function') {
                                callbackHolders.push(callback);
                            }
                        };
                        self.$setTheMap = function (map) {
                            //resolve all callbacks
                            for (var i = 0; i < callbackHolders.length; i++) {
                                callbackHolders[i](map);
                            }
                            callbackHolders = [];
                            self.map = map;
                        };
                        return self;
                    },
                    link: function (scope, iElement, iAttrs, ctrl) {
                        /*global google*/
                        if (typeof google === 'undefined') {
                            $log.error('There is no google maps lib. Please check that you load it before angular.js');
                            return;
                        }
                        var gmScope = scope.$new();
                        var options = gmScope.$eval(iAttrs['gmOptions']);
                        var readyCallback = gmScope.$eval(iAttrs['gmReady']);
                        var defaultOptions = {
                            zoom: 8,
                            center: new google.maps.LatLng(-34.397, 150.644)
                        };
                        var cssOpts = gmScope.$eval(iAttrs['cssOptions']);
                        options = options || {};
                        var defaultCssOptions = {
                            height: '100%',
                            width: '100%',
                            position: 'absolute'
                        };
                        angular.extend(defaultCssOptions, cssOpts);
                        angular.extend(defaultOptions, options);
                        iElement.css(defaultCssOptions);
                        var div = angular.element('<div>');
                        div.css({
                            height: '100%',
                            width: '100%',
                            margin: 0,
                            padding: 0
                        });
                        iElement.append(div);
                        var map = new google.maps.Map(div[0], defaultOptions);
                        if (typeof readyCallback === 'function') {
                            readyCallback(map);
                        }
                        map.openInfoWnd = function (content, map, marker, infoWindow, overrideOpen) {
                            overrideOpen.apply(infoWindow, [map, marker]);
                            if (infoWindow.$scope && infoWindow.$compiled) {
                                //update scope when info window reopened
                                $timeout(function () {
                                    infoWindow.$scope.$apply();
                                });
                            } else {
                                var childScope = gmScope.$new();
                                childScope.$infoWND = infoWindow;
                                infoWindow.$scope = childScope;
                                $timeout(function () {
                                    childScope.$apply();
                                });
                            }
                            //check if we already compiled template then don't need to do it again
                            if (infoWindow.$compiled !== true) {
                                var compiled = $compile(content.trim())(infoWindow.$scope);
                                infoWindow.$compiled = true;
                                infoWindow.setContent(compiled[0]);
                            }
                            if (typeof infoWindow.$onOpen !== 'function') {
                                infoWindow.$onOpen = function (gObj) {
                                    if (typeof infoWindow.onAfterOpen === 'function') {
                                        infoWindow.onAfterOpen(gObj);
                                    }
                                };
                            }
                        };
                        map.closeInfoWnd = function (infoWnd, overrideCloseMethod) {
                            if (infoWnd.$scope) {
                                infoWnd.$compiled = false;
                                infoWnd.$scope.$destroy();
                                delete infoWnd.$scope;
                                delete infoWnd.$compiled;
                            }
                            overrideCloseMethod.apply(infoWnd, []);
                        };
                        //push map to controller
                        ctrl.$setTheMap(map);
                    }
                }
            }
        ]);
})(angular);

/**
 * Created by artem on 10/7/15.
 */
(function (angular, geoXML3) {
    'use strict';
    angular.module('LogicifyGMap')
        .directive('xmlOverlays', [
            '$timeout',
            '$log',
            '$q',
            '$compile',
            '$http',
            'SmartCollection',
            function ($timeout, $log, $q, $compile, $http, SmartCollection) {
                return {
                    restrict: 'E',
                    require: '^logicifyGmap',
                    link: function (scope, element, attrs, ctrl) {
                        var geoXml3Parser = null;
                        scope.kmlCollection = new SmartCollection(scope.$eval(attrs['kmlCollection']));
                        scope.events = scope.$eval(attrs['gmapEvents']) || {};
                        scope.parserOptions = scope.$eval(attrs['parserOptions']) || {};
                        scope.onProgress = scope.$eval(attrs['onProgress']);
                        scope.fitBoundsAfterAll = scope.$eval(attrs['fitAllLayers']); //true by default
                        function getParserOptions(map, wnd) {
                            var opts = {};
                            angular.extend(opts, scope.parserOptions);
                            //override options
                            opts.map = map;
                            opts.afterParse = afterParse;
                            opts.onAfterCreateGroundOverlay = scope.events.onAfterCreateGroundOverlay;
                            opts.onAfterCreatePolygon = scope.events.onAfterCreatePolygon;
                            opts.onAfterCreatePolyLine = scope.events.onAfterCreatePolyLine;
                            opts.failedParse = failedParse;
                            opts.infoWindow = wnd;
                            return opts;
                        }

                        /**
                         * get google map object from controller
                         */
                        ctrl.$mapReady(function (map) {
                            scope.infowindow = scope.$eval(attrs['infoWindow']);
                            scope.collectionsWatcher = attachCollectionWatcher();
                            scope.gMap = map;
                            if (scope.infowindow && typeof scope.infowindow.$ready === 'function') {
                                scope.infowindow.$ready(function (wnd) {
                                    geoXml3Parser = new geoXML3.parser(getParserOptions(map, wnd));
                                    initKmlCollection();
                                });
                            } else {
                                geoXml3Parser = new geoXML3.parser(getParserOptions(map));
                                initKmlCollection();
                            }
                        });
                        scope.cancel = false;
                        scope.$on('$destroy', function () {
                            if (typeof scope.collectionsWatcher === 'function') {
                                scope.collectionsWatcher();//cancel watcher
                            }
                        });


                        /**
                         *
                         * @return {function()|*} listener
                         */
                        function attachCollectionWatcher() {
                            return scope.$watch('kmlCollection._uid', function (newValue, oldValue) {
                                //watch for top level object reference change
                                if (newValue == null) {
                                    scope.kmlCollection = new SmartCollection(scope.$eval(attrs['kmlCollection']));
                                    if (scope['downLoadingStarted'] === true || scope['parserStarted'] === true) {
                                        scope.cancel = true;
                                    }
                                    //if need cancel all.
                                    if (scope.cancel === true) {
                                        var cancellation = scope.$watch('cancel', function (newValue, oldValue) {
                                            //w8 for finish cancellation
                                            if (newValue === true) {
                                                initKmlCollection();//start init
                                                cancellation();//clear cancel listener
                                            }
                                        });
                                    } else {
                                        initKmlCollection();
                                    }
                                }
                            });
                        }

                        function onAddArrayItem(item) {
                            if (item != null) {
                                item.downloadNext = false;
                                scope.currentDocument = item;
                                downLoadOverlayFile(item);
                            }
                        }

                        function onRemoveArrayItem(item) {
                            clearAll(item);
                        }

                        /**
                         * Fires when kml or kmz file has been parsed
                         * @param doc - Array that contains only one item: [0] = {Document}
                         */
                        function afterParse(doc) {
                            if (scope.cancel === true) {
                                //cancel to next digest
                                $timeout(function () {
                                    scope.cancel = false;
                                });
                                return false;
                            }
                            doc[0].$uid = new Date().getTime() + '-index-' + Math.floor(Math.random() * ( -9));
                            scope.currentDocument.doc = doc;
                            if (typeof scope.events.onAfterParse === 'function') {
                                scope.events.onAfterParse(doc);
                            }
                            whenParserReadyAgain(null, scope.currentDocument);
                        }

                        /**
                         * Fires when failed parse kmz or kml
                         */
                        function failedParse() {
                            if (scope.cancel === true) {
                                //cancel to next digest
                                $timeout(function () {
                                    scope.cancel = false;
                                });
                                return false;
                            }
                            var error = {message: 'Failed to parse file url: ' + scope.currentDocument.url};
                            $log.error(error.message);
                            if (typeof scope.events.onAfterParseFailed === 'function') {
                                scope.events.onAfterParseFailed(error);
                            }
                            whenParserReadyAgain(error);
                        }

                        /**
                         * Calls by "failedParse" or "afterParse" methods
                         * @param error
                         * @param kmlObject
                         */
                        function whenParserReadyAgain(error, kmlObject) {
                            setValue('parserStarted', false, progress);
                            //if there's no reason to download next file
                            if (scope.currentDocument.downloadNext === false) {
                                delete scope.currentDocument.downloadNext;
                                initGlobalBounds();
                            } else {
                                scope.currentDocument = scope.kmlCollection.next() || false;
                                downLoadOverlayFile(scope.currentDocument);
                            }
                        }

                        /**
                         * Is needed for automation "onProgress", calling each time when downloading\parsing finished or started
                         * @param name - could be "downloadingStarted" or "parseStarted"
                         * @param value - boolean
                         * @param callProgress - if exist then call it (since it's users callback)
                         */
                        function setValue(name, value, callProgress) {
                            scope[name] = value;
                            if (typeof callProgress === 'function') {
                                callProgress();
                            }
                        }

                        function initGlobalBounds() {
                            scope.globalBounds = new google.maps.LatLngBounds();
                            if (scope.kmlCollection.length != 1 && scope.fitBoundsAfterAll !== false) {
                                scope.kmlCollection.forEach(function (item) {
                                    scope.globalBounds.extend(item.doc[0].bounds.getCenter());
                                });
                                $timeout(function () {
                                    scope.gMap.fitBounds(scope.globalBounds);
                                }, 10);
                            } else if (scope.kmlCollection.length > 0 && scope.fitBoundsAfterAll !== false) {
                                $timeout(function () {
                                    scope.gMap.fitBounds(scope.kmlCollection[0].doc[0].bounds);
                                }, 10);
                            }
                        }

                        /**
                         * Cleanup
                         */
                        function clearAll(item) {
                            if (item) {
                                geoXml3Parser.hideDocument(item.doc[0]);
                                var index = geoXml3Parser.docs.indexOf(item.doc[0]);
                                if (index > -1) {
                                    delete geoXml3Parser.docsByUrl[item.doc[0].baseUrl];
                                    geoXml3Parser.docs.splice(index, 1);
                                    initGlobalBounds();
                                }
                            } else {
                                angular.forEach(geoXml3Parser.docs, function (doc) {
                                    geoXml3Parser.hideDocument(doc);
                                });
                                geoXml3Parser.docs.splice(0, geoXml3Parser.docs.length);
                                geoXml3Parser.docsByUrl = {};
                                scope.globalBounds = null;
                                scope.currentDocument = null;
                            }
                        }

                        /**
                         * Download all files by asset
                         */
                        function initKmlCollection() {
                            if (!Array.isArray(scope.kmlCollection) || scope.kmlCollection.length === 0) {
                                scope.currentDocument = null;
                            } else {
                                scope['finished'] = false;
                                //if not first init then clear
                                if (scope.currentDocument == false || scope.currentDocument != null) {
                                    clearAll();
                                }
                                scope.currentDocument = scope.kmlCollection.next();
                                scope.kmlCollection.onAddItem(onAddArrayItem);
                                scope.kmlCollection.onRemoveItem(onRemoveArrayItem);
                                //start downloading kml collection
                                downLoadOverlayFile(scope.currentDocument);
                            }
                        }

                        /**
                         * Each time when "downLoadingStarted" or "parserStarted" changes we are calling this callback
                         */
                        function progress() {
                            if (typeof scope.onProgress === 'function') {
                                scope.onProgress({
                                    isDownloading: scope['downLoadingStarted'],
                                    isParsing: scope['parserStarted'],
                                    finished: scope['finished']
                                });
                            }
                        }

                        /**
                         * FIred when we need to start downloading of new kml or kmz file
                         * @param kmlObject
                         * @return {boolean}
                         */
                        function downLoadOverlayFile(kmlObject) {
                            if (!kmlObject) {
                                setValue('finished', true, progress);
                                initGlobalBounds();
                                return false;
                            }
                            if (scope.cancel === true) {
                                //cancel to next digest
                                $timeout(function () {
                                    scope.cancel = false;
                                });
                                return false;
                            }
                            setValue('downLoadingStarted', true, progress);
                            if (kmlObject.url != null) {
                                $http.get(kmlObject.url, {responseType: "arraybuffer"})
                                    .then(function (response) {
                                        var data = new Blob([response.data], {type: response.headers()['content-type']});
                                        data.lastModifiedDate = new Date();
                                        data.name = 'example' + data.lastModifiedDate;
                                        onAfterDownload(data);
                                    });

                            } else if (typeof kmlObject.content === 'String') {
                                onAfterDownload(null, kmlObject.content);
                            } else {
                                if (kmlObject instanceof Blob) {
                                    onAfterDownload(kmlObject);
                                } else {
                                    $log.error('Incorrect file type. Should be an instance of a Blob or String (url).');
                                }
                            }
                        }

                        /**
                         * When downloading finished we need start parsing
                         * @param blob - if it's a file
                         * @param content - if it's a string
                         */
                        function onAfterDownload(blob, content) {
                            if (scope.cancel === true) {
                                //cancel to next digest
                                $timeout(function () {
                                    scope.cancel = false;
                                });
                                return false;
                            }
                            setValue('parserStarted', true);
                            setValue('downLoadingStarted', false, progress);
                            content == null ? geoXml3Parser.parse(blob) : geoXml3Parser.parseKmlString(content);
                        }
                    }
                }
            }
        ]);
})(angular, geoXML3);
/**
 * Created by artem on 6/18/15.
 */
(function (angular) {
    /*global google*/
    angular.module('LogicifyGMap')
        .service('InfoWindow', ['$log', '$rootScope', '$templateCache', '$timeout', '$http', '$compile', function ($log, $rootScope, $templateCache, $timeout, $http, $compile) {
            function InfoWindow() {
                if (!google) {
                    $log.error('Google maps lib is not found. Please check that you load it before angular.');
                    return;
                }
                var self = this;
                //private
                var readyCallbackHolders = [], isInfoWndReady = false, lastMap = null;
                //public
                self['$ready'] = function (callback) {
                    if (isInfoWndReady === true && callback) {
                        callback(self);
                        return;
                    }
                    if (callback) {
                        readyCallbackHolders.push(callback);
                    }
                };

                //base logic function
                function overridesMethods(content) {
                    //override method 'open'
                    var overrideOpen = self['open'];
                    self['open'] = function (map, marker) {
                        lastMap = map;
                        if (typeof map.openInfoWnd === 'function') {
                            map.openInfoWnd(content, map, marker, self, overrideOpen);
                        }
                    };
                    //override method 'close'
                    var overrideClose = self['close'];
                    self['close'] = function (destroyScope) {
                        if (!lastMap) {
                            return;
                        }
                        if (typeof lastMap.closeInfoWnd === 'function' && destroyScope === true) {
                            lastMap.closeInfoWnd(self, overrideClose);
                        } else {
                            overrideClose.apply(self, []);
                        }
                    };
                    //notify all registered listeners that info window is ready
                    isInfoWndReady = true;
                    if (readyCallbackHolders.length > 0) {
                        for (var i = 0; i < readyCallbackHolders.length; i++) {
                            readyCallbackHolders[i](self);
                        }
                        readyCallbackHolders = [];
                    }
                }

                //if arguments
                if (arguments[0]) {
                    //select logic if info window creates via template url
                    if (arguments[0].templateUrl) {
                        $http.get(arguments[0].templateUrl, {cache: $templateCache})
                            .then(function (response) {
                                arguments[0].content = response.data;
                                google.maps.InfoWindow.apply(self, arguments);
                                overridesMethods(response.data);
                            });
                    } else if (arguments[0].content) {
                        //if via 'content'
                        google.maps.InfoWindow.apply(self, arguments);
                        overridesMethods(arguments[0].content);
                    }
                } else {
                    //if no args then just call parent constructor, because we can't handle it
                    google.maps.InfoWindow.apply(self, arguments);
                }
            }

            if (google) {
                InfoWindow.prototype = Object.create(google.maps.InfoWindow.prototype);
                InfoWindow.prototype.constructor = InfoWindow;
            }
            return InfoWindow;
        }])
})(angular);