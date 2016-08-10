angular.module('visualizationAppService', [])

.factory('visService', ['$q', '$location',
  function($q, $location) {
    var dataUrl = "https://ecd64fbd-15fa-42dd-8c0f-d043f1265319-bluemix.cloudant.com/mc/_design/logging/_view";
    if ($location.host().indexOf('bluemix.net') == -1) {
      dataUrl = "http://127.0.0.1:5984/mc/_design/logging/_view";
    }

    var dataVis = new SimpleDataVis(dataUrl);
    var timeformat = d3.time.format('%Y-%m-%d\r\n  %H:%M');
    var dateformat = d3.time.format('%Y-%m-%d');

    var summary = function() {
      var deferred = $q.defer();

      dataVis
        .attr('view', 'daily')
        .attr('param', null)
        .attr('startkey', '[""]')
        .attr('endkey', '[{}]')
        .attr('param', 'group_level', 1)
        .on('data', function(data) {
          var rows = data.rows || [];
          var allCols = ['siteId'];
          var allCounts = [];

          for (var row in rows) {
            rows[row].value['siteId'] = rows[row].key;
            allCounts.push(rows[row].value);
            for (var value in rows[row].value) {
              if (allCols.indexOf(value) === -1) {
                allCols.push(value);
              }
            }
          }
          return deferred.resolve(allCounts);
        })
        .render();

      return deferred.promise;
    };

    var siteDateKey = function(siteId, date, wildcard, prefix) {
      var key = [];

      var ar = date ? date.split('-') : [];
      if (ar.length == 3) {
        key = [Number(ar[0]), Number(ar[1]), Number(ar[2])];
      }
      
      if (siteId !== null && typeof siteId !== 'undefined') {
        key.length == 0 ? key.push(siteId) : key.unshift(siteId);
      }
      if (wildcard !== null && typeof wildcard !== 'undefined') {
        key.push(wildcard);
      }
      if (prefix !== null && typeof prefix !== 'undefined') {
        key.unshift(prefix);
      }

      return key;
    };

    var onDataCallbacks = {
      dailyactivity: function(data) {
        var rows = data.rows || [];

        rows.forEach(function(row) {
          row.key = typeof row.key[0] === 'string' ?
                      dateformat(new Date(row.key[1], row.key[2]-1, row.key[3])) :
                      dateformat(new Date(row.key[0], row.key[1]-1, row.key[2]))
        });

        return rows;
      },

      browserusage: function(data) {
        var kf = function(d) { return d.key[5]; };
        var rf = function(l) { return d3.sum(l, function(d) { return d.value;  }); };

        var rows = data.rows || [];
        var results = [];

        if (rows.length > 0) {
          // format: [{ key:"", values:# }, ...]
          results = d3.nest()
            .key(kf)
            .rollup(rf)
            .entries(rows);
        }

        results.forEach(function(d) {
          d.value = d.values;
          delete d.values;
        });

        return {
          data: results,
          keys: ['Chrome', 'Firefox', 'Safari', 'Internet Explorer', 'Other']
        }
      },

      toptensearches: function(data) {
        var kf = function(d) { return d.key[d.key.length - 1]; };
        var rf = function(l) {
          return d3.sum(l, function(d) { return d.value; })
        };

        var rows = data.rows || [];
        var results = [];

        if (rows.length > 0) {
          // format: [{ key:"", values:# }, ...]
          results = d3.nest()
            .key(kf)
            .rollup(rf)
            .entries(rows);
        }

        results.forEach(function(d) {
          d.value = d.values;
          delete d.values;
        });
        results = results.sort(function(a, b) { return b.value - a.value; });

        return results.slice(0, 10);
      },

      searchbycategories: function(data) {
        var kf = function(d) { return d.key[d.key.length - 1]; };
        var rf = function(l) { return d3.sum(l, function(d) { return d.value;  }); };

        var rows = data.rows || [];
        var results = [];

        if (rows.length > 0) {
          // format: [{ key:"", values:# }, ...]
          results = d3.nest()
            .key(kf)
            .rollup(rf)
            .entries(rows);
        }

        results.forEach(function(d) {
          d.value = d.values;
          delete d.values;
        });

        return results;
      },

      sixmonthsdaily: function(data) {
        var rows = data.rows || [];
        var allEvents = ['pageView', 'link', 'search'];
        var events = [];

        if (rows.length > 0) {
          // format: [{ key:"", date:date, value:# }, ...]
          rows.forEach(function(row) {
            allEvents.forEach(function(event) {
              if (row.value.hasOwnProperty(event)) {
                events.push({
                  key: event,
                  date: typeof row.key[0] === 'string' ?
                        new Date(row.key[1], row.key[2]-1, row.key[3]) :
                        new Date(row.key[0], row.key[1]-1, row.key[2]),
                  value: row.value[event]
                });
              }
            });
          });
        }

        return { data: events, keys: allEvents };
      },

      alltimetotal: function(data) {
        var rows = data.rows || [];
        var allCols = ['siteId'];
        var allCounts = [];

        for (var row in rows) {
          if (rows[row].key != 'hitsperday') {
            rows[row].value['siteId'] = 
              '<a href="#/dashboard?site=' + rows[row].key + '" class="type_link">' + rows[row].key + '</a>';

            allCounts.push(rows[row].value);

            for (var value in rows[row].value) {
              if (allCols.indexOf(value) === -1) {
                allCols.push(value);
              }
            }
          }
        }

        return { fields: allCols, data: allCounts };
      },

      recentactivities: function(data) {
        var rows = data.rows || [];
        var counts = [];
        for (var row in rows) {
          if (rows[row].doc) {
            counts.push({
              siteId: rows[row].value,
              type: rows[row].doc.type,
              url: rows[row].doc.url,
              date: timeformat(new Date(rows[row].doc.viewts * 1000))
            });
          }
        }
        return { fields: ['date', 'siteId', 'type', 'url'], data: counts };
      },

      hitsperday: function(data) {
        var rows = data.rows || [];
        var results = [];
        if (rows.length > 0) {
          var thirtydays = moment().subtract(29, 'days').toDate().getTime();
          var sevendays = moment().subtract(6, 'days').toDate().getTime();
          var sites = {};

          rows.forEach(function(row) {
            var date = new Date(row.key[1], row.key[2]-1, row.key[3]).getTime();
            var siteIds = Object.keys(row.value);

            siteIds.forEach(function(site) {
              var value = 
              sites[site] = sites[site] ? sites[site] : {};
              sites[site]['Last 90 days'] = (sites[site]['Last 90 days'] || 0) + row.value[site];
              sites[site]['Last 30 days'] = (sites[site]['Last 30 days'] || 0) + (date > thirtydays ? row.value[site] : 0);
              sites[site]['Last 7 days'] = (sites[site]['Last 7 days'] || 0) + (date > sevendays ? row.value[site] : 0);
            });
          });

          Object.keys(sites).forEach(function(site) {
            results.push({
              key: site,
              value: sites[site]
            });
          });
        }
        return results;
      }
    };

    var types = {
      alltimetotal: 'table-vis',
      hitsperday: 'grouped-bar-chart',
      recentactivities: 'table-vis',
      sixmonthsdaily: 'timeline',
      dailyactivity: 'grouped-bar-chart',
      browserusage: 'pie-chart',
      toptensearches: 'bar-chart',
      searchbycategories: 'bubble-chart'
    };

    var display = function(selection, options, refreshing) {
      var opts = options || {};
      var startkey = null;
      var endkey = null;
      var view = null;
      var group = null;

      dataVis.attr('param', null);

      switch(opts.visType) {
        case 'alltimetotal':
          startkey = '[""]';
          endkey = '[{}]';
          view = 'daily'
          dataVis
            .attr('param', 'group_level', 1)
            .attr('htmlcells', true);
          break;
        case 'recentactivities':
          view = 'time';
          dataVis
            .attr('param', 'descending', true)
            .attr('param', 'include_docs', true)
            .attr('param', 'limit', 50)
          break;
        case 'hitsperday':
          view = 'daily';
          var startDate = moment().subtract(89, 'days').format('YYYY-MM-DD');
          var endDate = moment().format('YYYY-MM-DD');
          startkey = siteDateKey(null, startDate, null, 'hitsperday');
          endkey = siteDateKey(null, endDate, {}, 'hitsperday');
          group = true;
          break;
        case 'sixmonthsdaily':
          startkey = moment().subtract(5, 'month').format('[[]YYYY,M,D[]]');
          endkey = moment().format('[[]YYYY,M,D[]]');
          view = 'daily';
          group = true;
          break;
        case 'dailyactivity':
          startkey = siteDateKey(opts.siteId, opts.startDate, null);
          endkey = siteDateKey(opts.siteId, opts.endDate, {});
          view = 'daily';
          group = true;
          break;
        case 'browserusage':
          startkey = siteDateKey(opts.siteId, opts.startDate, 0, 'useragent');
          endkey = siteDateKey(opts.siteId, opts.endDate, {}, 'useragent');
          view = 'property';
          group = true;
          dataVis.attr('donut', true);
          break;
        case 'toptensearches':
          startkey = siteDateKey(opts.siteId, opts.startDate, 0, 'search');
          endkey = siteDateKey(opts.siteId, opts.endDate, {}, 'search');
          view = 'property';
          group = true;
          break;
        case 'searchbycategories':
          startkey = siteDateKey(opts.siteId, opts.startDate, 0, 'searchcat');
          endkey = siteDateKey(opts.siteId, opts.endDate, {}, 'searchcat');
          view = 'property';
          group = true;
          break;
        default:
          break;
      }

      dataVis
        .attr('view', view)
        .attr('type', types[opts.visType])
        .attr('startkey', startkey)
        .attr('endkey', endkey)
        .attr('group', group)
        .on('start', function(url) {
          var p = this.node ? d3.select(this.node().parentNode) : this;
          if (!refreshing && p.select) {
            p.select('.spinner').style('visibility', 'initial');
          }
        })
        .on('data', function(data) {
          var p = this.node ? d3.select(this.node().parentNode) : this;
          if (p.select) {
            p.select('.spinner').style('visibility', null);
          }
          return onDataCallbacks[opts.visType](data);
        })
        .on('fail', function(err) {
          var p = this.node ? d3.select(this.node().parentNode) : this;
          if (p.select) {
            p.select('.spinner').style('visibility', null);
          }
          console.error(err);
        })
        .render(selection);
    }

    return {
      summary: summary,
      display: display
    }
  }
]);
