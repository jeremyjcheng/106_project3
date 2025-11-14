// Load D3 from CDN (for d3.csv method)
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

// Load future projection data (low/high emissions) by region
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

// Region + scenario state
let currentRegion = "Northeast";
let activeScenarios = ["historical", "low", "high"]; // Array of active scenarios
const regions = ["Northeast", "Midwest", "South", "Northwest"];
let regionData = null;
let futureData = null;

// Charles: year range chosen by user (null means full range)
let yearStart = null;
let yearEnd = null;

// Charles: one flag to show or hide all regression lines (default ON)
let showRegression = true;

// Charles: window size for smoothing regression curve (odd number recommended)
// Charles: smaller value -> curve follows data more closely (more wiggly)
// Charles: larger value -> curve is smoother and less curved
const TREND_WINDOW = 14;

document.addEventListener("DOMContentLoaded", async function () {
  initializeRegionDots();
  initializeLegendState();
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
    setYearInputLimits();
    drawChart();
  } else {
    svg.select("text").text("Error loading data. Check console for details.");
  }
});

function setYearInputLimits() {
  const allYears = [
    ...regions.flatMap((r) => {
      const key = r.toLowerCase();
      return [
        ...(regionData[key]?.map((d) => +d.year) || []),
        ...(futureData[key]?.map((d) => +d.year) || []),
      ];
    }),
  ];
  const [min, max] = [Math.min(...allYears), Math.max(...allYears)];
  const startInput = document.getElementById("yearStartInput");
  const endInput = document.getElementById("yearEndInput");
  if (startInput) {
    startInput.min = min;
    startInput.max = max;
    startInput.placeholder = min;
  }
  if (endInput) {
    endInput.min = min;
    endInput.max = max;
    endInput.placeholder = max;
  }
}

// Create clickable dots for the 4 regions
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

// Initialize legend state to show all items as selected on page load
function initializeLegendState() {
  updateLegendVisualState();
}

// Update legend visual state based on activeScenarios array
function updateLegendVisualState() {
  document.querySelectorAll(".legend-item").forEach((item) => {
    const scenario = item.dataset.scenario;
    if (!scenario) return; // Skip regression toggle

    const box = item.querySelector(".legend-box");
    if (activeScenarios.includes(scenario)) {
      item.classList.add("active");
      box.classList.add("selected");
    } else {
      item.classList.remove("active");
      box.classList.remove("selected");
    }
  });
}

// Set up button, legend, year window and regression toggle interactions
function setupEventListeners() {
  document.getElementById("prevBtn").addEventListener("click", () => {
    navigateRegion("prev");
  });

  document.getElementById("nextBtn").addEventListener("click", () => {
    navigateRegion("next");
  });

  // Charles: scenario legend click to filter which lines are visible
  document.querySelectorAll(".legend-item").forEach((item) => {
    const scenario = item.dataset.scenario;
    if (!scenario) return;
    item.addEventListener("click", function () {
      const s = this.dataset.scenario;
      // Toggle this scenario in the array
      if (activeScenarios.includes(s)) {
        activeScenarios = activeScenarios.filter((sc) => sc !== s);
      } else {
        activeScenarios.push(s);
      }
      updateLegendVisualState();
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
      const min = +yearStartInput.min,
        max = +yearStartInput.max;
      const start = parseInt(yearStartInput.value, 10);
      const end = parseInt(yearEndInput.value, 10);
      yearStart = Number.isNaN(start)
        ? null
        : Math.max(min, Math.min(max, start));
      yearEnd = Number.isNaN(end) ? null : Math.max(min, Math.min(max, end));
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

  // Charles: toggle one switch for all regression curves
  const regToggle = document.getElementById("regressionToggle");
  if (regToggle) {
    regToggle.classList.toggle("active", showRegression);
    regToggle.addEventListener("click", () => {
      showRegression = !showRegression;
      regToggle.classList.toggle("active", showRegression);
      drawChart();
    });
  }
}

// When user clicks a region dot
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

// Cycle through regions with Previous / Next buttons
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

// Charles: build a smoothed trend curve using moving average
// Charles: this replaces strict straight-line regression with a flexible curve
function computeRegressionLine(data) {
  if (!data || data.length < 2) {
    return null;
  }

  // Charles: sort by year to make sure x is increasing
  const sorted = [...data].sort((a, b) => a.year - b.year);

  // Charles: use the global TREND_WINDOW but not larger than data length
  const windowSize = Math.min(TREND_WINDOW, sorted.length);
  const half = Math.floor(windowSize / 2);

  const result = sorted.map((d, i) => {
    let start = Math.max(0, i - half);
    let end = Math.min(sorted.length - 1, i + half);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sum += sorted[j].value;
      count++;
    }
    return {
      year: d.year,
      value: sum / count,
    };
  });

  return result;
}

// Core drawing function (called whenever state changes)
function drawChart() {
  if (!regionData || !futureData) {
    console.error("No region data or future data available");
    return;
  }

  const width = 900;
  const height = 500;
  const margin = { top: 60, right: 100, bottom: 80, left: 90 };

  d3.select("#chartSvg").selectAll("*").remove();

  const svg = d3
    .select("#chartSvg")
    .attr("width", width)
    .attr("height", height);

  const regionKey = currentRegion.toLowerCase();

  // Map raw CSV rows into numeric {year, value} objects
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

  // Charles: if invalid window, fall back to full domain
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

  // Connect future lines to the end of historical line
  const lastHistoricalPoint = historicalData[historicalData.length - 1];
  const lowWithConnection =
    filteredLow.length > 0 && filteredLow[0].year > lastHistoricalPoint.year
      ? [lastHistoricalPoint, ...filteredLow]
      : filteredLow;
  const highWithConnection =
    filteredHigh.length > 0 && filteredHigh[0].year > lastHistoricalPoint.year
      ? [lastHistoricalPoint, ...filteredHigh]
      : filteredHigh;

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

  // Add axis labels
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", margin.left - 80)
    .attr("x", -height / 2)
    .style("text-anchor", "middle")
    .style("font-size", "14px")
    .style("fill", "#333")
    .style("font-weight", "500")
    .text("Precipitation");

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .style("text-anchor", "middle")
    .style("font-size", "14px")
    .style("fill", "#333")
    .style("font-weight", "500")
    .text("Year");

  // Charles: dashed line at 2014 if inside range
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

    // Label for the vertical line
    svg
      .append("text")
      .attr("x", xScale(2014))
      .attr("y", height - margin.bottom + 30)
      .attr("text-anchor", "middle")
      .attr("fill", "#999")
      .style("font-size", "12px")
      .text("2014");
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

  // Historical line + invisible circles for tooltip
  if (activeScenarios.includes("historical")) {
    svg
      .append("path")
      .datum(filteredHistorical)
      .attr("fill", "none")
      .attr("stroke", "#888")
      .attr("stroke-width", 3)
      .attr("d", line)
      .attr("opacity", 1);

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

  // Low emission (SSP 126)
  if (activeScenarios.includes("low")) {
    svg
      .append("path")
      .datum(lowWithConnection)
      .attr("fill", "none")
      .attr("stroke", "#1e88e5")
      .attr("stroke-width", 3)
      .attr("d", line)
      .attr("opacity", 1)
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

  // High emission (SSP 585)
  if (activeScenarios.includes("high")) {
    svg
      .append("path")
      .datum(highWithConnection)
      .attr("fill", "none")
      .attr("stroke", "#e53935")
      .attr("stroke-width", 3)
      .attr("d", line)
      .attr("opacity", 1)
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

  // Charles: draw smoothed regression curves when toggle is on
  if (showRegression) {
    const regLine = d3
      .line()
      .x((d) => xScale(d.year))
      .y((d) => yScale(d.value))
      .curve(d3.curveBasis);

    if (activeScenarios.includes("historical")) {
      const regHist = computeRegressionLine(filteredHistorical);
      if (regHist) {
        svg
          .append("path")
          .datum(regHist)
          .attr("fill", "none")
          .attr("stroke", "#555")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "6,4")
          .attr("d", regLine);
      }
    }

    if (activeScenarios.includes("low")) {
      const regLow = computeRegressionLine(lowWithConnection);
      if (regLow) {
        svg
          .append("path")
          .datum(regLow)
          .attr("fill", "none")
          .attr("stroke", "#b71c1c")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "6,4")
          .attr("d", regLine);
      }
    }

    if (activeScenarios.includes("high")) {
      const regHigh = computeRegressionLine(highWithConnection);
      if (regHigh) {
        svg
          .append("path")
          .datum(regHigh)
          .attr("fill", "none")
          .attr("stroke", "#0d47a1")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "6,4")
          .attr("d", regLine);
      }
    }
  }
}
