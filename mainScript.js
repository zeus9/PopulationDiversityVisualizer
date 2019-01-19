    var margin = { top: 20, right: 20, bottom: 20, left: 20 } //not yet used in map caluclations

    var clickedCountryId = null;

    var mapWidth = 650,
      mapHeight = 500,
      active = d3.select(null);

    //for choropleth
    var lowColor = '#ffffff'
    var highColor = '#000000'

    // set the dimensions and margins of the bar graph
    var barGraphWidth = 500,
      barGraphHeight = 400;


    d3.queue()
      .defer(d3.json, "us.json")
      .defer(d3.csv, "us_states.csv")
      .defer(d3.csv, "us_counties.csv")
      .defer(d3.csv, "us_communities.csv")
      .await(mapDriver);

    function mapDriver(error, usJson, usStates, usCounties, usCommunities) {
      if (error) throw error;

      var projection = d3.geoAlbersUsa() // updated for d3 v4
        .scale(1000)
        .translate([mapWidth / 2, mapHeight / 2]);

      var zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", zoomed);

      var path = d3.geoPath() // updated for d3 v4
        .projection(projection);


      //make ramp for choropleth
      var dataArray = [];
      for (var i = 0; i < usStates.length; i++) {
        dataArray.push(parseFloat(usStates[i].Diversity_Index))
      }
      var minVal = d3.min(dataArray)
      var maxVal = d3.max(dataArray)
      var ramp = d3.scaleLinear().domain([minVal, maxVal]).range([lowColor, highColor])

      // Loop through each state data value in the .csv file
      for (var i = 0; i < usStates.length; i++) {

        // Grab State Name
        var dataId = usStates[i].Id;

        // Grab data value 
        var dataValue = usStates[i].Diversity_Index;

        // Find the corresponding state inside the GeoJSON
        for (var j = 0; j < usJson.objects.states.geometries.length; j++) {
          var jsonStateId = usJson.objects.states.geometries[j].id;

          if (dataId == jsonStateId) {

            // Copy the data value into the JSON
            usJson.objects.states.geometries[j].properties = {};
            usJson.objects.states.geometries[j].properties.diversityIndex = dataValue;

            // Stop looking through the JSON111
            break;
          }
        }
      }


      var svg = d3.select("body").append("svg")
        .attr("width", mapWidth)
        .attr("height", mapHeight)
        .attr("class", "explanation")
        .on("click", stopped, true);


      svg.append("rect")
        .attr("class", "background")
        .attr("width", mapWidth)
        .attr("height", mapHeight)
        .on("click", reset);

      var g = svg.append("g");

      svg.call(zoom); // delete this line to disable free zooming

      g.selectAll("path")
        .data(topojson.feature(usJson, usJson.objects.states).features)
        .enter().append("path")
        .attr("d", path)
        .attr("class", "feature")
        //.style("stroke", "#fff")
        .style("stroke-width", "1")
        .style("fill", function (d) {
          return ramp(d.properties.diversityIndex);
        })
        .on("click", clicked)
        .on("mouseover", function (d, i) {
          //var currentState = this;

          let stateName = null;
          let index = null;
          for (var i = 0; i < usStates.length; i++) {
            if (usStates[i].Id == d.id) {
              stateName = usStates[i].Location;
              index = usStates[i].Diversity_Index;
            }
          }

          d3.select("#tooltip")
            .transition()
            .duration(200)
            .style("opacity", 0.9);

          d3.select("#tooltip").html(tooltipHtml(stateName, index))
            .style("left", (d3.event.pageX) + "px")
            .style("top", (d3.event.pageY - 28) + "px");


        })
        .on("mouseout", function (d, i) {

          d3.select("#tooltip").transition().duration(500).style("opacity", 0);
        });


      g.append("path")
        .datum(topojson.mesh(usJson, usJson.objects.states, function (a, b) { return a !== b; }))
        .attr("class", "mesh")
        .attr("d", path);


      //bar graph
      // usStates.forEach(function (data) {
      //   data.sales = +data.sales;
      // });

      //get all communities from usStates
      var communities = Object.keys(usStates[0]);
      communities.splice(communities.indexOf('Location'), 1);
      communities.splice(communities.indexOf('Id'), 1);




      function clicked(d) {

        let legend = {
          "Black or African American alone, percent, 2013": "African Americans",
          "American Indian and Alaska Native alone, percent, 2013": "Indians",
          "Asian alone, percent, 2013": "Asians",
          "Native Hawaiian and Other Pacific Islander alone, percent,": "Hawaiian",
          "Two or More Races, percent, 2013": "Mixed",
          "Hispanic or Latino, percent, 2013": "Latino",
          "White alone, not Hispanic or Latino, percent, 2013": "Caucasion"
        };

        d3.selectAll(".bar").remove('*');
        d3.selectAll(".barGraph").remove('*');

        clickedCountryId = d.id;
        let clickedState = null;


        if (active.node() === this) return reset();
        active.classed("active", false);
        active = d3.select(this).classed("active", true);

        //add counties
        // d3.json("us.json", function (error, us) {
        g.append("path")
          .datum(topojson.mesh(usJson, usJson.objects.states, function (a, b) { return a !== b; }))
          .attr("class", "mesh")
          .attr("d", path)
          .attr("id", "pathCounty");
        // });

        var bounds = path.bounds(d),
          dx = bounds[1][0] - bounds[0][0],
          dy = bounds[1][1] - bounds[0][1],
          xx = (bounds[0][0] + bounds[1][0]) / 2,
          yy = (bounds[0][1] + bounds[1][1]) / 2,
          scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / mapWidth, dy / mapHeight))),
          translate = [mapWidth / 2 - scale * xx, mapHeight / 2 - scale * yy];

        svg.transition()
          .duration(750)
          .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)); // updated for d3 v4


        //bar graph
        let stateElement = null;
        for (var i = 0; i < usStates.length; i++) {
          if (usStates[i].Id == d.id)
            stateElement = usStates[i];
          clickedState = usStates[i].Location;
        }

        let currentKey = null;
        let stateDictObject = [];
        var a = Object.keys(stateElement).forEach(function (key) {
          if (key !== "Id" && key !== "Location" && key !== "Diversity_Index") {
            stateDictObject.push({
              key: key,
              value: stateElement[key]
            });
          }
        });

        let x = d3.scaleBand()
          .range([0, barGraphWidth])
          .padding(0.1);
        let y = d3.scaleLinear()
          .range([barGraphHeight, 0]);

        // append the svg object to the body of the page
        // append a 'group' element to 'svg'
        // moves the 'group' element to the top left margin
        let xTranslation = margin.left;
        let yTranslation = margin.top;
        var barSvg = d3.select("body").append("svg")
          .attr("class", "barGraph")
          .attr("width", barGraphWidth + margin.left + margin.right)
          .attr("height", barGraphHeight + margin.top + margin.bottom)
          .append("g")
          .attr("transform",
            "translate(" + xTranslation + "," - yTranslation + ")");

        //make  data positive for bar graph
        stateDictObject.forEach(function (d) {
          d.value = +d.value;
          console.log(d.value);
        });

        // Scale the range of the data in the domains
        x.domain(stateDictObject.map(function (data) { return legend[data.key] })); //.substring(0,4);
        y.domain([0, d3.max(stateDictObject, function (data) { return data.value; })]);

        //draw bar graph
        barSvg.selectAll(".bar")
          .data(stateDictObject)
          .enter().append("rect")
          .attr("class", "bar")
          .attr("x", function (data) {
            var b = x(legend[data.key]);
            // debugger;
            return b;
          })
          .attr("width", "20px")
          .attr("y", function (data) {
            var a = y(data.value);
            // debugger;
            return a;
          })
          .attr("height", function (data) { return barGraphHeight - y(data.value) })
          .attr("transform", "translate(" + margin.left + ",0)");

        // add the x Axis
        barSvg.append("g")
          .attr("transform", "translate(0," + barGraphHeight + ")")
          .call(d3.axisBottom(x))
          .selectAll("text")
          .style("text-anchor", "center");

        // add the y Axis
        barSvg.append("g")
          .call(d3.axisLeft(y));

      }


      function reset() {
        active.classed("active", false);
        active = d3.select(null);
        //remove counties
        d3.selectAll("#pathCounty").style("display", "none");


        svg.transition()
          .duration(750)
          .call(zoom.transform, d3.zoomIdentity); // updated for d3 v4

      }

      function zoomed() {
        g.style("stroke-width", 1.5 / d3.event.transform.k + "px");
        g.attr("transform", d3.event.transform); // updated for d3 v4

      }

      // If drag behavior prevents the default click,
      // also stop propagation so we don’t click-to-zoom.
      function stopped() {
        if (d3.event.defaultPrevented) d3.event.stopPropagation();
      }

      function clone(obj) {
        var copy;

        // Handle the 3 simple types, and null or undefined
        if (null == obj || "object" != typeof obj) return obj;

        // Handle Date
        if (obj instanceof Date) {
          copy = new Date();
          copy.setTime(obj.getTime());
          return copy;
        }

        // Handle Array
        if (obj instanceof Array) {
          copy = [];
          for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = clone(obj[i]);
          }
          return copy;
        }

        // Handle Object
        if (obj instanceof Object) {
          copy = {};
          for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
          }
          return copy;
        }

        throw new Error("Unable to copy obj! Its type isn't supported.");
      }
    }
