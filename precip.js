// Stacked precipitation overview (city x year) with hover identify & click-to-detail (D3 v7)
// Data: us_historical.csv columns: city, year, pr (precip value)
const OVER = d3.select("#overview");
const MODAL = d3.select("#modal");
const CLOSE = d3.select("#close");
const MTITLE = d3.select("#mtitle");
const DETAIL = d3.select("#detail");

const tooltip = d3.select("body").append("div")
  .attr("class","tooltip").style("opacity",0);

const fmtYear = d3.format("d");
const fmtVal = d3.format(".2e"); // scientific like your earlier screenshot
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

d3.csv("us_historical.csv", d3.autoType).then(rows => {
  // canonical sets
  const years = d3.sort(d3.union(rows.map(d => d.year)));
  const cities = d3.sort(d3.union(rows.map(d => d.city)));

  // aligned wide table: {year, city1, city2, ...}
  const byYear = years.map(y => {
    const o = { year: y };
    for (const c of cities) o[c] = 0;
    for (const r of rows) if (r.year === y) o[r.city] = r.pr || 0;
    return o;
  });

  // order layers by each city's peak year for nicer visual ordering
  function peakYearFor(city){
    let m = -Infinity, my = years[0];
    for(const y of years){
      const v = rows.find(r=>r.year===y && r.city===city)?.pr || 0;
      if (v > m){ m = v; my = y; }
    }
    return my;
  }
  const citiesSorted = d3.sort(cities, (a,b)=> d3.ascending(peakYearFor(a), peakYearFor(b)));

  const stack = d3.stack()
    .keys(citiesSorted)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const series = stack(byYear);

  const margin = {t:10, r:70, b:30, l:50};
  const width = Math.max(1000, OVER.node().clientWidth || 0);
  const height = 560;
  const innerW = width - margin.l - margin.r;
  const innerH = height - margin.t - margin.b;

  const x = d3.scaleLinear().domain(d3.extent(years)).range([0, innerW]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(series[series.length-1], d => d[1])]).nice()
    .range([innerH, 0]);

  const svg = OVER.append("svg").attr("viewBox", `0 0 ${width} ${height}`);
  const g = svg.append("g").attr("transform", `translate(${margin.l},${margin.t})`);

  // axes (right y = total precipitation that year)
  g.append("g").attr("class","axis")
    .attr("transform",`translate(${innerW},0)`)
    .call(d3.axisRight(y).ticks(10));
  g.append("g").attr("class","axis")
    .attr("transform",`translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d=> (d%10===0? `${d}s`: "")));

  const area = d3.area()
    .x((_,i) => x(years[i]))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))
    .curve(d3.curveLinear);

  const layers = g.append("g")
    .selectAll("path")
    .data(series.map((s,i)=>({key:citiesSorted[i], values:s})))
    .join("path")
    .attr("class","layer")
    .attr("d", d => area(d.values));

  // overlay for interactions
  g.append("rect")
    .attr("width", innerW).attr("height", innerH)
    .attr("fill", "none").style("pointer-events","all")
    .on("mousemove", (event)=>{
      const [mx,my] = d3.pointer(event);
      const year = Math.round(x.invert(mx));
      const idx = clamp(years.indexOf(year), 0, years.length-1);

      let hit = null;
      for (let i=series.length - 1; i>=0; i--){
        const seg = series[i][idx];
        if (my >= y(seg[1]) && my <= y(seg[0])) { hit = i; break; }
      }
      if (hit===null){ layers.classed("focus",false).classed("dim",false); tooltip.style("opacity",0); return; }

      const key = citiesSorted[hit];
      layers.classed("focus",(d, i)=> i===hit).classed("dim",(d,i)=> i!==hit);

      const val = byYear[idx][key];
      tooltip.style("opacity",1)
        .style("left",(event.pageX)+"px")
        .style("top",(event.pageY)+"px")
        .html(`<b>${key}</b><br/>Decade: ${Math.floor(year/10)*10}s<br/>Precip: ${fmtVal(val)}`);
    })
    .on("mouseleave", ()=>{
      layers.classed("focus",false).classed("dim",false);
      tooltip.style("opacity",0);
    })
    .on("click", (event)=>{
      const [mx,my] = d3.pointer(event);
      const year = Math.round(x.invert(mx));
      const idx = clamp(years.indexOf(year), 0, years.length-1);

      let hit = null;
      for (let i=series.length - 1; i>=0; i--){
        const seg = series[i][idx];
        if (my >= y(seg[1]) && my <= y(seg[0])) { hit = i; break; }
      }
      if (hit!==null){
        const key = citiesSorted[hit];
        openDetail(key, rows.filter(r=>r.city===key));
      }
    });

  CLOSE.on("click", ()=> MODAL.attr("aria-hidden","true"));
  MODAL.on("click", (e)=>{ if (e.target===MODAL.node()) MODAL.attr("aria-hidden","true"); });

  function openDetail(city, data){
    MODAL.attr("aria-hidden","false");
    DETAIL.selectAll("*").remove();
    MTITLE.text(city);

    const M = {t:10,r:70,b:38,l:50};
    const W = Math.max(980, DETAIL.node().clientWidth || 0);
    const H = DETAIL.node().clientHeight || 560;
    const w = W - M.l - M.r, h = H - M.t - M.b;

    const x = d3.scaleLinear().domain(d3.extent(data, d=>d.year)).range([0,w]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d=>d.pr)]).nice().range([h,0]);

    const svg = DETAIL.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    const g = svg.append("g").attr("transform",`translate(${M.l},${M.t})`);

    g.append("g").attr("class","axis").attr("transform",`translate(${w},0)`).call(d3.axisRight(y).ticks(10));
    g.append("g").attr("class","axis").attr("transform",`translate(0,${h})`).call(d3.axisBottom(x).ticks(10).tickFormat(d=> (d%10===0? `${d}s`: "")));

    const area = d3.area()
      .x(d => x(d.year))
      .y0(h)
      .y1(d => y(d.pr))
      .curve(d3.curveLinear);

    g.append("path").datum(data.sort((a,b)=>d3.ascending(a.year,b.year))).attr("fill","#f39a85").attr("opacity",.85).attr("d", area);

    svg.append("text")
      .attr("class","nameLabel")
      .attr("x", W/2).attr("y", H/2).text(city);
  }
});
