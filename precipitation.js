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
let activeScenario = 'all';
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
            activeScenario = activeScenario === scenario ? 'all' : scenario;
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
    
    // Clear previous content
    d3.select('#chartSvg').selectAll('*').remove();
    
    const svg = d3.select('#chartSvg')
        .attr('width', width)
        .attr('height', height);
    
    // Get current region data and convert to numbers
    const regionKey = currentRegion.toLowerCase();
    const historicalData = regionData[regionKey].map(d => ({
        year: +d.year,
        value: +d.pr,
        type: 'historical'
    }));
    
    // Get future data for low and high emissions from CSV
    const lowEmissionData = futureData[regionKey].map(d => ({
        year: +d.year,
        value: +d.low_emissions_pr,
        type: 'low-emission'
    }));
    
    const highEmissionData = futureData[regionKey].map(d => ({
        year: +d.year,
        value: +d.high_emissions_pr,
        type: 'high-emission'
    }));
    
    console.log(`Drawing ${currentRegion}`);
    console.log('Historical sample:', historicalData.slice(0, 3));
    console.log('Low emission sample:', lowEmissionData.slice(0, 3));
    console.log('High emission sample:', highEmissionData.slice(0, 3));
    
    // Get year range from actual data
    const historicalStart = d3.min(historicalData, d => d.year);
    const futureEnd = d3.max([...lowEmissionData, ...highEmissionData], d => d.year);
    
    // Scales
    const xScale = d3.scaleLinear()
        .domain([historicalStart, futureEnd])
        .range([margin.left, width - margin.right]);
    
    const allValues = [...historicalData, ...lowEmissionData, ...highEmissionData].map(d => d.value);

    const yScale = d3.scaleLinear()
        .domain([d3.min(allValues), d3.max(allValues)])
        .range([height - margin.bottom, margin.top]);
    
    // Add axes
    const xAxis = d3.axisBottom(xScale).tickFormat(d3.format('d'));
    const yAxis = d3.axisLeft(yScale).tickFormat(d3.format('.2e'));
    
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(xAxis)
        .style('font-size', '12px');
    
    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(yAxis)
        .style('font-size', '12px');
    
    // Add vertical line at 2014
    svg.append('line')
        .attr('x1', xScale(2014))
        .attr('x2', xScale(2014))
        .attr('y1', margin.top)
        .attr('y2', height - margin.bottom)
        .attr('stroke', '#999')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');
    
    // Add labels
    svg.append('text')
        .attr('x', xScale((historicalStart + 2014) / 2))
        .attr('y', margin.top - 10)
        .attr('text-anchor', 'middle')
        .attr('fill', '#999')
        .style('font-size', '16px')
        .text('Historical');
    
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
    
    // Draw historical line
    const opacity = activeScenario === 'all' ? 1 : 0.3;
    
    if (activeScenario === 'all' || activeScenario === 'historical') {
        svg.append('path')
            .datum(historicalData)
            .attr('fill', 'none')
            .attr('stroke', '#888')
            .attr('stroke-width', 3)
            .attr('d', line)
            .attr('opacity', activeScenario === 'historical' ? 1 : opacity);
    }
    
    // Draw low emission line
    if (activeScenario === 'all' || activeScenario === 'low') {
        svg.append('path')
            .datum(lowEmissionData)
            .attr('fill', 'none')
            .attr('stroke', '#e53935')
            .attr('stroke-width', 3)
            .attr('d', line)
            .attr('opacity', activeScenario === 'low' ? 1 : 0.8)
            .style('cursor', 'pointer')
            .on('mouseover', function() {
                d3.select(this).attr('stroke-width', 5);
            })
            .on('mouseout', function() {
                d3.select(this).attr('stroke-width', 3);
            });
    }
    
    // Draw high emission line
    if (activeScenario === 'all' || activeScenario === 'high') {
        svg.append('path')
            .datum(highEmissionData)
            .attr('fill', 'none')
            .attr('stroke', '#1e88e5')
            .attr('stroke-width', 3)
            .attr('d', line)
            .attr('opacity', activeScenario === 'high' ? 1 : 0.8)
            .style('cursor', 'pointer')
            .on('mouseover', function() {
                d3.select(this).attr('stroke-width', 5);
            })
            .on('mouseout', function() {
                d3.select(this).attr('stroke-width', 3);
            });
    }
    
    // Add scenario labels
    svg.append('text')
        .attr('x', xScale(2090))
        .attr('y', yScale(lowEmissionData[lowEmissionData.length - 1].value))
        .attr('fill', '#e53935')
        .style('font-size', '13px')
        .style('font-weight', 'bold')
        .text('SSP126');
    
    svg.append('text')
        .attr('x', xScale(2090))
        .attr('y', yScale(lowEmissionData[lowEmissionData.length - 1].value) + 15)
        .attr('fill', '#e53935')
        .style('font-size', '11px')
        .text('(low-emission)');
    
    svg.append('text')
        .attr('x', xScale(2090))
        .attr('y', yScale(highEmissionData[highEmissionData.length - 1].value))
        .attr('fill', '#1e88e5')
        .style('font-weight', 'bold')
        .style('font-size', '13px')
        .text('SSP 585');
    
    svg.append('text')
        .attr('x', xScale(2090))
        .attr('y', yScale(highEmissionData[highEmissionData.length - 1].value) + 15)
        .attr('fill', '#1e88e5')
        .style('font-size', '11px')
        .text('(high emission)');
    
    // Add experiment ID labels
    const midHistoricalValue = d3.median(historicalData, d => d.value);
    svg.append('text')
        .attr('x', xScale(1900))
        .attr('y', yScale(midHistoricalValue * 0.5))
        .attr('fill', '#999')
        .style('font-size', '11px')
        .style('font-style', 'italic')
        .text('experiment-id = historical');
    
    svg.append('text')
        .attr('x', xScale(2050))
        .attr('y', yScale(highEmissionData[highEmissionData.length - 1].value * 1.2))
        .attr('fill', '#1e88e5')
        .style('font-size', '11px')
        .text('experiment-id = SSP 585 (high emission)');
}
