async function loadHistoricalByRegion() {
  try {
    const [midwest, northeast, northwest, south] = await Promise.all([
      d3.csv("historical_data/midwest_historical_precipitation.csv"),
      d3.csv("historical_data/northeast_historical_precipitation.csv"),
      d3.csv("historical_data/northwest_historical_precipitation.csv"),
      d3.csv("historical_data/south_historical_precipitation.csv"),
    ]);

    return {
      midwest,
      northeast,
      northwest,
      south,
    };
  } catch (err) {
    console.error("Failed to load historical data:", err);
    return null;
  }
}

async function loadFutureByRegion() {
  try {
    const [midwest, northeast, northwest, south] = await Promise.all([
      d3.csv("future_data/midwest_futures_merged.csv"),
      d3.csv("future_data/northeast_futures_merged.csv"),
      d3.csv("future_data/northwest_futures_merged.csv"),
      d3.csv("future_data/south_futures_merged.csv"),
    ]);

    return {
      midwest,
      northeast,
      northwest,
      south,
    };
  } catch (err) {
    console.error("Failed to load future data:", err);
    return null;
  }
}

let currentRegion = "Northeast";
let activeScenario = "all";
const regions = ["Northeast", "Midwest", "South", "Northwest"];
let regionData = null;
let futureData = null;

// Charles: year range chosen by user (null means full range)
let yearStart = null;
let yearEnd = null;

document.addEventListener("DOMContentLoaded", async function () {
  initializeRegionDots();
  setupEventListeners();

  const svg = d3.select("#chartSvg");
  svg.attr("width", 900).attr("height", 500);
  svg
    .append("text")
    .attr("x", 450)
    .attr("y", 250)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .text("Loading data...");

  [regionData, futureData] = await Promise.all([
    loadHistoricalByRegion(),
    loadFutureByRegion(),
  ]);

  if (regionData && futureData) {
    drawChart();
  } else {
    svg.select("text").text("Error loading data. Check console for details.");
  }
});

function initializeRegionDots() {
  const dotsContainer = document.getElementById("dotsContainer");
  regions.forEach((region) => {
    const dot = document.createElement("span");
    dot.className = "dot" + (region === currentRegion ? " active" : "");
    dot.textContent = region === currentRegion ? "●" : "○";
    dot.dataset.region = region;
    dot.addEventListener("click", () => selectRegion(region));
    dotsContainer.appendChild(dot);
  });
}

function setupEventListeners() {
  document.getElementById("prevBtn").addEventListener("click", () => {
    navigateRegion("prev");
  });

  document.getElementById("nextBtn").addEventListener("click", () => {
    navigateRegion("next");
  });

  document.querySelectorAll(".legend-item").forEach((item) => {
    item.addEventListener("click", function () {
      const scenario = this.dataset.scenario;
      activeScenario = activeScenario === scenario ? "all" : scenario;
      drawChart();
    });
  });

  const yearStartInput = document.getElementById("yearStartInput");
  const yearEndInput = document.getElementById("yearEndInput");
  const applyBtn = document.getElementById("applyYearBtn");
  const resetBtn = document.getElementById("resetYearBtn");

  // Charles: when user clicks Apply, save year range and redraw
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      const startVal = parseInt(yearStartInput.value, 10);
      const endVal = parseInt(yearEndInput.value, 10);

      yearStart = Number.isNaN(startVal) ? null : startVal;
      yearEnd = Number.isNaN(endVal) ? null : endVal;

      drawChart();
    });
  }

  // Charles: when user clicks Reset, clear year range
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      yearStart = null;
      yearEnd = null;
      if (yearStartInput) yearStartInput.value = "";
      if (yearEndInput) yearEndInput.value = "";
      drawChart();
    });
  }
}

function selectRegion(region) {
  currentRegion = region;
  document.getElementById("regionName").textContent = region;

  document.querySelectorAll(".dot").forEach((dot) => {
    const isActive = dot.dataset.region === region;
    dot.className = "dot" + (isActive ? " active" : "");
    dot.textContent = isActive ? "●" : "○";
  });

  drawChart();
}

function navigateRegion(direction) {
  const currentIndex = regions.indexOf(currentRegion);
  let newIndex;

  if (direction === "next") {
    newIndex = (currentIndex + 1) % regions.length;
  } else {
    newIndex = (currentIndex - 1 + regions.length) % regions.length;
  }

  selectRegion(regions[newIndex]);
}

function drawChart() {
  if (!regionData || !futureData) {
    console.error("No region data or future data available");
    return;
  }

  const width = 900;
  const height = 500;
  const margin = { top: 60, right: 100, bottom: 80, left: 60 };

  d3.select("#chartSvg").selectAll("*").remove();

  const svg = d3
    .select("#chartSvg")
    .attr("width", width)
    .attr("height", height);

  const regionKey = currentRegion.toLowerCase();
  const historicalData = regionData[regionKey].map((d) => ({
    year: +d.year,
    value: +d.pr,
    type: "historical",
  }));

  const lowEmissionData = futureData[regionKey].map((d) => ({
    year: +d.year,
    value: +d.low_emissions_pr,
    type: "low-emission",
  }));

  const highEmissionData = futureData[regionKey].map((d) => ({
    year: +d.year,
    value: +d.high_emissions_pr,
    type: "high-emission",
  }));

  const fullHistoricalStart = d3.min(historicalData, (d) => d.year);
  const fullFutureEnd = d3.max(
    [...lowEmissionData, ...highEmissionData],
    (d) => d.year
  );

  // Charles: decide x-axis start and end using user input or full range
  let domainStart = yearStart != null ? yearStart : fullHistoricalStart;
  let domainEnd = yearEnd != null ? yearEnd : fullFutureEnd;

  domainStart = Math.max(domainStart, fullHistoricalStart);
  domainEnd = Math.min(domainEnd, fullFutureEnd);

  if (domainEnd < domainStart) {
    domainStart = fullHistoricalStart;
    domainEnd = fullFutureEnd;
  }

  // Charles: filter all series to this year window
  const filteredHistorical = historicalData.filter(
    (d) => d.year >= domainStart && d.year <= domainEnd
  );
  const filteredLow = lowEmissionData.filter(
    (d) => d.year >= domainStart && d.year <= domainEnd
  );
  const filteredHigh = highEmissionData.filter(
    (d) => d.year >= domainStart && d.year <= domainEnd
  );

  const xScale = d3
    .scaleLinear()
    .domain([domainStart, domainEnd])
    .range([margin.left, width - margin.right]);

  const allValues = [
    ...filteredHistorical,
    ...filteredLow,
    ...filteredHigh,
  ].map((d) => d.value);

  const yScale = d3
    .scaleLinear()
    .domain([d3.min(allValues), d3.max(allValues)])
    .range([height - margin.bottom, margin.top]);

  const xAxis = d3.axisBottom(xScale).tickFormat(d3.format("d"));
  const yAxis = d3.axisLeft(yScale).tickFormat(d3.format(".2e"));

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(xAxis)
    .style("font-size", "12px");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(yAxis)
    .style("font-size", "12px");

  if (2014 >= domainStart && 2014 <= domainEnd) {
    svg
      .append("line")
      .attr("x1", xScale(2014))
      .attr("x2", xScale(2014))
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom)
      .attr("stroke", "#999")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5");
  }

  svg
    .append("text")
    .attr("x", xScale((domainStart + Math.min(2014, domainEnd)) / 2))
    .attr("y", margin.top - 10)
    .attr("text-anchor", "middle")
    .attr("fill", "#999")
    .style("font-size", "16px")
    .text("Historical");

  svg
    .append("text")
    .attr("x", xScale((Math.max(2014, domainStart) + domainEnd) / 2))
    .attr("y", margin.top - 10)
    .attr("text-anchor", "middle")
    .attr("fill", "#ff9800")
    .style("font-size", "16px")
    .text("Future");

  const line = d3
    .line()
    .x((d) => xScale(d.year))
    .y((d) => yScale(d.value))
    .curve(d3.curveBasis);

  const tooltip = d3.select("#tooltip");
  const svgNode = svg.node();

  const showTooltip = function (event, d) {
    const xPos = xScale(d.year);
    const yPos = yScale(d.value);
    const chartContainer = d3.select(".chart-container").node();
    const containerRect = chartContainer.getBoundingClientRect();
    const svgRect = svgNode.getBoundingClientRect();

    const svgOffsetX = svgRect.left - containerRect.left;
    const svgOffsetY = svgRect.top - containerRect.top;

    tooltip
      .html(`Year: ${d.year}<br>Precipitation: ${d.value.toExponential(2)}`)
      .style("left", svgOffsetX + xPos + 10 + "px")
      .style("top", svgOffsetY + yPos - 40 + "px")
      .classed("visible", true);
  };

  const hideTooltip = function () {
    tooltip.classed("visible", false);
  };

  const opacity = activeScenario === "all" ? 1 : 0.3;

  if (activeScenario === "all" || activeScenario === "historical") {
    svg
      .append("path")
      .datum(filteredHistorical)
      .attr("fill", "none")
      .attr("stroke", "#888")
      .attr("stroke-width", 3)
      .attr("d", line)
      .attr("opacity", activeScenario === "historical" ? 1 : opacity);

    svg
      .selectAll(".historical-point")
      .data(filteredHistorical)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d.year))
      .attr("cy", (d) => yScale(d.value))
      .attr("r", 10)
      .attr("fill", "transparent")
      .attr("stroke", "none")
      .style("cursor", "pointer")
      .style("pointer-events", "all")
      .on("mouseover", showTooltip)
      .on("mouseout", hideTooltip);
  }

  if (activeScenario === "all" || activeScenario === "low") {
    svg
      .append("path")
      .datum(filteredLow)
      .attr("fill", "none")
      .attr("stroke", "#e53935")
      .attr("stroke-width", 3)
      .attr("d", line)
      .attr("opacity", activeScenario === "low" ? 1 : 0.8)
      .style("cursor", "pointer")
      .on("mouseover", function () {
        d3.select(this).attr("stroke-width", 5);
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke-width", 3);
      });

    svg
      .selectAll(".low-point")
      .data(filteredLow)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d.year))
      .attr("cy", (d) => yScale(d.value))
      .attr("r", 10)
      .attr("fill", "transparent")
      .attr("stroke", "none")
      .style("cursor", "pointer")
      .style("pointer-events", "all")
      .on("mouseover", showTooltip)
      .on("mouseout", hideTooltip);
  }

  if (activeScenario === "all" || activeScenario === "high") {
    svg
      .append("path")
      .datum(filteredHigh)
      .attr("fill", "none")
      .attr("stroke", "#1e88e5")
      .attr("stroke-width", 3)
      .attr("d", line)
      .attr("opacity", activeScenario === "high" ? 1 : 0.8)
      .style("cursor", "pointer")
      .on("mouseover", function () {
        d3.select(this).attr("stroke-width", 5);
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke-width", 3);
      });

    svg
      .selectAll(".high-point")
      .data(filteredHigh)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d.year))
      .attr("cy", (d) => yScale(d.value))
      .attr("r", 10)
      .attr("fill", "transparent")
      .attr("stroke", "none")
      .style("cursor", "pointer")
      .style("pointer-events", "all")
      .on("mouseover", showTooltip)
      .on("mouseout", hideTooltip);
  }

  svg
    .append("text")
    .attr("x", xScale(Math.min(2090, domainEnd)))
    .attr(
      "y",
      yScale(lowEmissionData[lowEmissionData.length - 1].value)
    )
    .attr("fill", "#e53935")
    .style("font-size", "13px")
    .style("font-weight", "bold");

  svg
    .append("text")
    .attr("x", xScale(Math.min(2090, domainEnd)))
    .attr(
      "y",
      yScale(lowEmissionData[lowEmissionData.length - 1].value) + 15
    )
    .attr("fill", "#e53935")
    .style("font-size", "11px");

  svg
    .append("text")
    .attr("x", xScale(Math.min(2090, domainEnd)))
    .attr(
      "y",
      yScale(highEmissionData[highEmissionData.length - 1].value)
    )
    .attr("fill", "#1e88e5")
    .style("font-weight", "bold")
    .style("font-size", "13px");

  svg
    .append("text")
    .attr("x", xScale(Math.min(2090, domainEnd)))
    .attr(
      "y",
      yScale(highEmissionData[highEmissionData.length - 1].value) + 15
    )
    .attr("fill", "#1e88e5")
    .style("font-size", "11px");

  const midHistoricalValue = d3.median(historicalData, (d) => d.value);
  svg
    .append("text")
    .attr("x", xScale(Math.max(1900, domainStart)))
    .attr("y", yScale(midHistoricalValue * 0.5))
    .attr("fill", "#999")
    .style("font-size", "11px")
    .style("font-style", "italic")
    .text("experiment-id = historical");

  svg
    .append("text")
    .attr("x", xScale(Math.min(2050, domainEnd)))
    .attr(
      "y",
      yScale(highEmissionData[highEmissionData.length - 1].value * 1.2)
    )
    .attr("fill", "#1e88e5")
    .style("font-size", "11px")
    .text("experiment-id = SSP 585 (high emission)");
}