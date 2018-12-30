let app = angular.module('AbccTools', ['ngMaterial', 'ngAnimate', 'md.data.table']);
let bg = chrome.extension.getBackgroundPage();

app.config(['$compileProvider', '$mdThemingProvider', function ($compileProvider, $mdThemingProvider) {
    'use strict';

    $compileProvider.debugInfoEnabled(false);

    $mdThemingProvider.theme('default')
        .primaryPalette('blue')
        .accentPalette('pink');
}]);

app.controller('Controller', function($scope, $rootScope, Listener) {

    $scope.isLogin =  bg._AbccTools.account;
    $scope.volume = bg._AbccTools.getVolume();
    $scope.ticker = [];
    $scope.ticker_pair = 'btc';
    $scope.ticker_sort = '-tick.volume';
    $scope.Sorting = function (a) {
        $scope.ticker_sort = a;
    };

    Listener.Subscribe();

    $rootScope.$on('app.update', function(event, data) {

        switch (data.action) {
            case "ticker": {
                console.log(data)
                $scope.ticker = [];
                for (var i in data.data) {
                    data.data[i].volume = data.data[i].volume * 1;
                    data.data[i].change = data.data[i].change * 1;
                    data.data[i].spread = 100 * (data.data[i].sell*1 - data.data[i].buy*1)/data.data[i].sell*1;
                    $scope.ticker.push(data.data[i])
                }

                console.log($scope.ticker_sort)

                switch ($scope.ticker_sort) {
                    case 'tick.volume' :
                        $scope.ticker = $scope.ticker.sort(function (a, b) {
                            if (a.volume < b.volume) return -1;
                            if (a.volume > b.volume) return 1;
                            return 0;
                        });
                        break;

                    case '-tick.volume' :
                        $scope.ticker = $scope.ticker.sort(function (a, b) {
                            if (a.volume < b.volume) return 1;
                            if (a.volume > b.volume) return -1;
                            return 0;
                        });
                        break;
                    case 'tick.change' :
                        $scope.ticker = $scope.ticker.sort(function (a, b) {
                            if (a.change < b.change) return -1;
                            if (a.change > b.change) return 1;
                            return 0;
                        });
                        break;

                    case '-tick.change' :
                        $scope.ticker = $scope.ticker.sort(function (a, b) {
                            if (a.change < b.change) return 1;
                            if (a.change > b.change) return -1;
                            return 0;
                        });
                        break;
                    case 'tick.spread' :
                        $scope.ticker = $scope.ticker.sort(function (a, b) {
                            if (a.spread < b.spread) return -1;
                            if (a.spread > b.spread) return 1;
                            return 0;
                        });
                        break;

                    case '-tick.spread' :
                        $scope.ticker = $scope.ticker.sort(function (a, b) {
                            if (a.spread < b.spread) return 1;
                            if (a.spread > b.spread) return -1;
                            return 0;
                        });
                        break;

                }

                break;
            }
        }


        $scope.$apply();
    });

});

app.service('Listener', function($window, $rootScope) {

    function subsFunc() {

        chrome.runtime.onMessage.addListener(
            function(request, sender, sendResponse) {
                $rootScope.$broadcast('app.update', request);
            }
        );
    }

    return {
        "Subscribe": subsFunc,
    }
});