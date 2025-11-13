// Load D3 from CDN (for d3.csv method)
async function loadHistoricalByRegion() {
  try {
    const [
      midwest,
      northeast,
      northwest,
      south
    ] = await Promise.all([
      d3.csv('historical_data/midwest_historical_precipitation.csv'),
      d3.csv('historical_data/northeast_historical_precipitation.csv'),
      d3.csv('historical_data/northwest_historical_precipitation.csv'),
      d3.csv('historical_data/south_historical_precipitation.csv')
    ]);

    return {
      midwest,
      northeast,
      northwest,
      south
    };

  } catch (err) {
    console.error("Failed to load historical data:", err);
    return null;
  }
}

async function loadFutureByRegion() {
    try {
        const [
      midwest,
      northeast,
      northwest,
      south
    ] = await Promise.all([
      d3.csv('future_data/midwest_futures_merged.csv'),
      d3.csv('future_data/northeast_futures_merged.csv'),
      d3.csv('future_data/northwest_futures_merged.csv'),
      d3.csv('future_data/south_futures_merged.csv')
    ]);

    return { 
        midwest, 
        northeast, 
        northwest, 
        south 
    };
    
  } catch (err) {
        console.error("Failed to load future data:", err);
        return null;
    }
}

// State
let currentRegion = 'Northeast';
let activeScenarios = []; // 'low', 'high', or null for all
const regions = ['Northeast', 'Midwest', 'South', 'Northwest'];
let regionData = null;
let futureData = null;

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    initializeRegionDots();
    setupEventListeners();
    
    // Show loading message
    const svg = d3.select('#chartSvg');
    svg.attr('width', 900).attr('height', 500);
    svg.append('text')
        .attr('x', 450)
        .attr('y', 250)
        .attr('text-anchor', 'middle')
        .style('font-size', '18px')
        .text('Loading data...');
    
    // Load both historical and future data
    [regionData, futureData] = await Promise.all([
        loadHistoricalByRegion(),
        loadFutureByRegion()
    ]);
    
    if (regionData && futureData) {
        console.log('✓ All historical data loaded successfully!');
        console.log('✓ All future data loaded successfully!');
        console.log('Historical data structure:', regionData);
        console.log('Future data structure:', futureData);
        drawChart();
    } else {
        svg.select('text').text('Error loading data. Check console for details.');
    }
});

function initializeRegionDots() {
    const dotsContainer = document.getElementById('dotsContainer');
    regions.forEach(region => {
        const dot = document.createElement('span');
        dot.className = 'dot' + (region === currentRegion ? ' active' : '');
        dot.textContent = region === currentRegion ? '●' : '○';
        dot.dataset.region = region;
        dot.addEventListener('click', () => selectRegion(region));
        dotsContainer.appendChild(dot);
    });
}

function setupEventListeners() {
    document.getElementById('prevBtn').addEventListener('click', () => {
        navigateRegion('prev');
    });
    
    document.getElementById('nextBtn').addEventListener('click', () => {
        navigateRegion('next');
    });
    
    document.querySelectorAll('.legend-item').forEach(item => {
        item.addEventListener('click', function() {
        const scenario = this.dataset.scenario;
        const box = this.querySelector('.legend-box');

        if (activeScenarios.includes(scenario)) {
            // Remove scenario if already selected
            activeScenarios = activeScenarios.filter(s => s !== scenario);
            box.classList.remove('selected');  
        } else {
            // Add scenario
            activeScenarios.push(scenario);
            box.classList.add('selected'); 
        }

        // If nothing is selected, treat as "all"
        if (activeScenarios.length === 0) {
            activeScenarios = ['all'];
        }

        drawChart();
        });
    });
}

function selectRegion(region) {
    currentRegion = region;
    document.getElementById('regionName').textContent = region;
    
    document.querySelectorAll('.dot').forEach(dot => {
        const isActive = dot.dataset.region === region;
        dot.className = 'dot' + (isActive ? ' active' : '');
        dot.textContent = isActive ? '●' : '○';
    });
    
    drawChart();
}

function navigateRegion(direction) {
    const currentIndex = regions.indexOf(currentRegion);
    let newIndex;
    
    if (direction === 'next') {
        newIndex = (currentIndex + 1) % regions.length;
    } else {
        newIndex = (currentIndex - 1 + regions.length) % regions.length;
    }
    
    selectRegion(regions[newIndex]);
}

function drawChart() {
    if (!regionData || !futureData) {
        console.error('No region data or future data available');
        return;
    }
    
    const width = 900;
    const height = 500;
    const margin = { top: 60, right: 100, bottom: 80, left: 60 };
    
    // Clear chart
    d3.select('#chartSvg').selectAll('*').remove();
    
    const svg = d3.select('#chartSvg')
        .attr('width', width)
        .attr('height', height);
    
    // Get region key
    const regionKey = currentRegion.toLowerCase();
    
    // Historical data
    const historicalData = regionData[regionKey].map(d => ({
        year: +d.year,
        value: +d.pr,
        type: 'historical'
    }));

    // Future datasets
    const lowEmissionData = futureData[regionKey].map(d => ({
        year: +d.year,
        value: +d.low_emissions_pr,
        type: 'low'
    }));

    const highEmissionData = futureData[regionKey].map(d => ({
        year: +d.year,
        value: +d.high_emissions_pr,
        type: 'high'
    }));

    // CONNECT last historical point to future scenarios
    const lastHistoricalPoint = historicalData[historicalData.length - 1];

    const lowWithConnection = [
        lastHistoricalPoint,
        ...lowEmissionData
    ];

    const highWithConnection = [
        lastHistoricalPoint,
        ...highEmissionData
    ];
    
    // Year range
    const historicalStart = d3.min(historicalData, d => d.year);
    const futureEnd = d3.max([...lowEmissionData, ...highEmissionData], d => d.year);
    
    // Scales
    const xScale = d3.scaleLinear()
        .domain([historicalStart, futureEnd])
        .range([margin.left, width - margin.right]);
    
    const allValues = [
        ...historicalData,
        ...lowEmissionData,
        ...highEmissionData
    ].map(d => d.value);

    const yScale = d3.scaleLinear()
        .domain([d3.min(allValues), d3.max(allValues)])
        .range([height - margin.bottom, margin.top]);
    
    // Axes
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format('d')))
        .style('font-size', '12px');
    
    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(yScale).tickFormat(d3.format('.2e')))
        .style('font-size', '12px');
    
    // Vertical break line at 2014
    svg.append('line')
        .attr('x1', xScale(2014))
        .attr('x2', xScale(2014))
        .attr('y1', margin.top)
        .attr('y2', height - margin.bottom)
        .attr('stroke', '#999')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');
    
    // Labels
    svg.append('text')
        .attr('x', xScale((historicalStart + 2014) / 2))
        .attr('y', margin.top - 10)
        .attr('text-anchor', 'middle')
        .attr('fill', '#999')
        .style('font-size', '16px')
        .text('Past');
    
    svg.append('text')
        .attr('x', xScale(2057))
        .attr('y', margin.top - 10)
        .attr('text-anchor', 'middle')
        .attr('fill', '#ff9800')
        .style('font-size', '16px')
        .text('Future');

    // Line generator
    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.value))
        .curve(d3.curveBasis);

    // Tooltip
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

    const hideTooltip = () => tooltip.classed("visible", false);

    // Show all if nothing selected
    const showAll = activeScenarios.length === 0;


    // --- HISTORICAL ---
    if (showAll || activeScenarios.includes('historical')) {
        svg.append('path')
            .datum(historicalData)
            .attr('fill', 'none')
            .attr('stroke', '#888')
            .attr('stroke-width', 3)
            .attr('opacity', 1)
            .attr('d', line);

        svg.selectAll(".historical-point")
            .data(historicalData)
            .enter()
            .append("circle")
            .attr("cx", d => xScale(d.year))
            .attr("cy", d => yScale(d.value))
            .attr("r", 10)
            .attr("fill", "transparent")
            .style("cursor", "pointer")
            .on("mouseover", showTooltip)
            .on("mouseout", hideTooltip);
    }


    // --- LOW EMISSIONS ---
    if (showAll || activeScenarios.includes('low')) {
        svg.append('path')
            .datum(lowWithConnection)  // connected dataset
            .attr('fill', 'none')
            .attr('stroke', '#1e88e5')
            .attr('stroke-width', 3)
            .attr('opacity', 1)
            .attr('d', line);

        svg.selectAll(".low-point")
            .data(lowEmissionData)
            .enter()
            .append("circle")
            .attr("cx", d => xScale(d.year))
            .attr("cy", d => yScale(d.value))
            .attr("r", 10)
            .attr("fill", "transparent")
            .style("cursor", "pointer")
            .on("mouseover", showTooltip)
            .on("mouseout", hideTooltip);
    }


    // --- HIGH EMISSIONS ---
    if (showAll || activeScenarios.includes('high')) {
        svg.append('path')
            .datum(highWithConnection) // connected dataset
            .attr('fill', 'none')
            .attr('stroke', '#e53935')
            .attr('stroke-width', 3)
            .attr('opacity', 1)
            .attr('d', line);

        svg.selectAll(".high-point")
            .data(highEmissionData)
            .enter()
            .append("circle")
            .attr("cx", d => xScale(d.year))
            .attr("cy", d => yScale(d.value))
            .attr("r", 10)
            .attr("fill", "transparent")
            .style("cursor", "pointer")
            .on("mouseover", showTooltip)
            .on("mouseout", hideTooltip);
    }
}
