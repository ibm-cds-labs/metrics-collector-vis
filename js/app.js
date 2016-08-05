'use strict';

//Visualization App
var mainApp = angular.module('visualizationApp',
  ['ngRoute', 'visualizationAppService'],
  function($locationProvider) {
    //$locationProvider.html5Mode({'enabled': true, 'requireBase': false});
  }
)

.config(function($sceProvider) {
  $sceProvider.enabled(false);
})

.config(function($routeProvider) {
  $routeProvider
    .when('/', {
      templateUrl: 'home.html'
    })
    .when('/summary', {
      templateUrl: 'summary.html',
      controller: 'summaryCtrl',
      reloadOnSearch: false
    })
    .when('/dashboard', {
      templateUrl: 'dashboard.html',
      controller: 'dashboardCtrl',
      reloadOnSearch: false,
      resolve: {
        sitesSummary: ['visService', function(visService) {
          return visService.summary();
        }]
      }
    })
    .otherwise({
      redirectTo: 'index.html'
    });
})

.controller('navCtrl', ['$scope',
  function($scope) {
    $scope.$root.$on('$routeChangeSuccess', function(event, current, previous) {
      $scope.currentPath = current.$$route.originalPath;
    });
  }]
)

.controller('summaryCtrl', ['$scope', '$location',
  function($scope, $location) {
    $scope.summary = {};

    var titles = {
      alltimetotal: 'Total all time for each site',
      hitsperday: 'Hits per day',
      recentactivities: 'Most recent activities across all sites',
      sixmonthsdaily: 'Daily total across all sites in the past six months'
    };

    $scope.summary.visType = 'sixmonthsdaily';
    $scope.summary.refreshRate = 10;
    $scope.visTitle = titles[$scope.summary.visType];

    var updateLocation = function() {
      $location.search({
        chart: $scope.summary.visType,
        refresh: $scope.summary.refreshRate
      });
    };

    var search = $location.search();

    if (search.hasOwnProperty('chart')) {
      $scope.summary.visType = search.chart;
    }

    if (search.hasOwnProperty('refresh')) {
      try {
        var refresh = parseInt(search.refresh, 10);
        $scope.summary.refreshRate = refresh > 0 ? refresh : $scope.summary.refreshRate;
      }
      catch(e) {
        $scope.summary.refreshRate = 10;
      }
    }

    $scope.updateSummary = function(vistype, refreshrate) {
      if (vistype) {
        $scope.summary.visType = vistype;
        $scope.visTitle = titles[vistype];
      }
      else {
        $scope.visTitle = titles[$scope.summary.visType];
      }

      if (refreshrate) {
        try {
          var refresh = Number(refreshrate);
          if (!isNaN(refresh) && refresh > 0) {
            $scope.summary.refreshRate = refresh;
          }
        }
        catch(e) {
          $scope.summary.refreshRate = 10;
        }
      }

      updateLocation();
    };
  }]
)

.controller('dashboardCtrl', ['$scope', '$location', 'sitesSummary',
  function($scope, $location, sitesSummary) {
    $scope.sitesSummary = sitesSummary;
    $scope.sites = [];
    var defaultsite = null;
    sitesSummary.forEach(function(s) {
      if (s.siteId[0] !== 'hitsperday') {
        if (s.siteId[0] === 'cds.devcenter' && !defaultsite) defaultsite = 'cds.devcenter';
        if (s.siteId[0] === 'cds.search.engine') defaultsite = 'cds.search.engine';
        $scope.sites.push({
          siteId: s.siteId[0],
          search: !!s.search
        });
      }
    });
    
    var initStart = moment().subtract(29, 'days');
    var initEnd = moment().add(1, 'day');
    var minDate = moment().subtract(2, 'year').startOf('year');
    var maxDate = moment().add(2, 'day');

    $scope.dashboard = {
      siteId: defaultsite ? defaultsite : $scope.sites.length > 0 ? $scope.sites[0].siteId : null,
      startDate: initStart.format('YYYY-MM-DD'),
      endDate: initEnd.format('YYYY-MM-DD'),
      visType: 'dailyactivity'
    };
    
    var updateInput = function(start, end) {
      $('input[name="daterange"]')
        .val(start.format('MMMM D, YYYY') + ' - ' + end.format('MMMM D, YYYY'));
    };

    var updateLocation = function() {
      $location.search({
        chart: $scope.dashboard.visType,
        site: $scope.dashboard.siteId,
        startdate: $scope.dashboard.startDate,
        enddate: $scope.dashboard.endDate
      });
    };
    
    $('input[name="daterange"]')
      .daterangepicker({
        format: 'MM/DD/YYYY',
        startDate: initStart,
        endData: initEnd,
        minDate: minDate,
        maxDate: maxDate,
        // dateLimit: { days: 180 },
        ranges: {
          'Today': [moment(), moment()],
          'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
          'Last 7 Days': [moment().subtract(6, 'days'), moment()],
          'Last 30 Days': [moment().subtract(29, 'days'), moment()]
        },
        locale: {
          applyLabel: 'Submit'
        },
        buttonClasses: ['button_calendar'],
        applyClass: 'button_primary',
        cancelClass: 'button_secondary',
        opens: 'left'
      },
      function(startDate, endDate, label) {
        updateInput(startDate, endDate);

        $scope.$apply(function() {
          $scope.dashboard.startDate = startDate.format('YYYY-MM-DD');
          $scope.dashboard.endDate = endDate.format('YYYY-MM-DD');
          updateLocation();
        });
      });

    var search = $location.search();
    if (search.hasOwnProperty('site')) {
      $scope.dashboard.siteId = search.site;
    }
    if (search.hasOwnProperty('chart')) {
      $scope.dashboard.visType = search.chart;
    }
    if (search.hasOwnProperty('startdate')) {
      $scope.dashboard.startDate = search.startdate;
    }
    if (search.hasOwnProperty('enddate')) {
      $scope.dashboard.endDate = search.enddate;
    }

    $scope.updateDashboard = function(vistype) {
      if (vistype) {
        $scope.dashboard.visType = vistype;
      }

      $scope.disableSearches = $scope.sites.some(function(s) {
        return $scope.dashboard.siteId == s.siteId && !s.search; 
      });

      updateLocation();
    };

    $scope.disableSearches = $scope.sites.some(function(s) {
      return $scope.dashboard.siteId == s.siteId && !s.search; 
    });

    updateInput(moment($scope.dashboard.startDate, 'YYYY-MM-DD'), moment($scope.dashboard.endDate, 'YYYY-MM-DD'));
  }]
)

.directive('metricsViz', ['visService', '$interval', function(visService, $interval) {
    return {
      restrict: 'A',
      scope: {
        metricsViz: '=',
      },
      replace: true,
      templateUrl: 'vis.html',
      link: function(scope, elem, attrs) {
        var visElem = d3.select(elem[0]).select('.vis-container');
        var poll;

        var refresh = function(options) {
          if (poll) $interval.cancel(poll);
          if (options.refreshRate) {
            poll = $interval(function() {
              visService.display(visElem, options, true);
            }, options.refreshRate * 1000 * 60);
          }
        }

        visService.display(visElem, scope.metricsViz);

        scope.$watch('metricsViz', function(newValue, oldValue) {
          if (oldValue !== newValue) {
            visService.display(visElem, newValue);
            refresh(newValue);
          }
        }, true);

        refresh(scope.metricsViz);
      }
    };
  }]
);
