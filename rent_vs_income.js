// load the CSV data
d3.csv("income_vs_rent.csv").then(function (data) {
    // parse numbers
    data.forEach(d => {
        d.Personal_Income_Avg = +d.Personal_Income_Avg;
        d.Total_Rent_Avg = +d.Total_Rent_Avg;
    });

    const width = 700, height = 500;
    const margin = { top: 50, right: 150, bottom: 60, left: 70 };

    // get unique neighborhoods
    const neighborhoods = [...new Set(data.map(d => d.Neighborhood))];
    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(neighborhoods);

    // create layout container
    const container = d3.select("#scatterplot")
        .append("div")
        .style("display", "flex");

    // create SVG plot on the left
    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", "#f9f9f9");

    // tooltip div
    const tooltip = d3.select("#scatterplot")
        .append("div")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("padding", "8px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("box-shadow", "0px 2px 6px rgba(0,0,0,0.1)")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("font-size", "12px");

    // create control panel on the right
    const controlPanel = container.append("div")
        .style("margin-left", "30px")
        .style("max-width", "250px");

    controlPanel.append("p")
        .style("font-weight", "bold")
        .text("Toggle Neighborhoods:");

    const checkboxContainer = controlPanel
        .append("div")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("gap", "6px");

    neighborhoods.forEach(n => {
        checkboxContainer.append("label")
            .html(`<input type="checkbox" checked value="${n}"> ${n}`);
    });

    // opacity slider
    controlPanel.append("label")
        .text("Opacity:")
        .style("margin-top", "20px")
        .style("display", "block");

    controlPanel.append("input")
        .attr("type", "range")
        .attr("min", 0.1)
        .attr("max", 1)
        .attr("step", 0.05)
        .attr("value", 0.7)
        .attr("id", "opacitySlider");

    // scales
    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.Personal_Income_Avg)).nice()
        .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d.Total_Rent_Avg)).nice()
        .range([height - margin.bottom, margin.top + 30]);

    // axes
    svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));

    // axis labels
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 15)
        .attr("text-anchor", "middle")
        .text("Personal Income (Avg)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .text("Total Rent (Avg)");

    // legend box 
    const legend = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top - 25})`);

    const itemsPerRow = Math.ceil(neighborhoods.length / 3);
    const itemWidth = 150;

    neighborhoods.forEach((n, i) => {
        const row = Math.floor(i / itemsPerRow);
        const col = i % itemsPerRow;

        const item = legend.append("g")
            .attr("transform", `translate(${col * itemWidth}, ${row * 20})`);

        item.append("rect")
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", color(n))
            .attr("y", -10);

        item.append("text")
            .attr("x", 18)
            .attr("y", 0)
            .attr("alignment-baseline", "middle")
            .style("font-size", "12px")
            .text(n.length > 20 ? n.slice(0, 17) + "…" : n);
    });

    // scatter points
    const pointsGroup = svg.append("g");

    const drawPoints = (opacity = 0.7) => {
        const visibleNeighborhoods = new Set();
        d3.selectAll("input[type=checkbox]:checked").each(function () {
            visibleNeighborhoods.add(this.value);
        });

        const filtered = data.filter(d => visibleNeighborhoods.has(d.Neighborhood));

        const circles = pointsGroup.selectAll("circle")
            .data(filtered, d => d.Personal_Income_Avg + '-' + d.Total_Rent_Avg);

        const merged = circles.enter()
            .append("circle")
            .attr("cx", d => x(d.Personal_Income_Avg))
            .attr("cy", d => y(d.Total_Rent_Avg))
            .attr("r", 5)
            .attr("fill", d => color(d.Neighborhood))
            .on("mouseover", (event, d) => {
                tooltip.transition().duration(200).style("opacity", 0.95);
                tooltip.html(`
            <strong>${d.Neighborhood}</strong><br>
            Rent: $${d.Total_Rent_Avg.toFixed(2)}<br>
            Income: $${d.Personal_Income_Avg.toFixed(2)}
          `);
            })
            .on("mousemove", event => {
                tooltip
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", () => {
                tooltip.transition().duration(300).style("opacity", 0);
            });

        merged.merge(circles)
            .transition()
            .duration(300)
            .attr("opacity", opacity);

        circles.exit().remove();
    };

    // regression line
    function drawRegressionLine(filteredData) {
        const n = filteredData.length;
        const xMean = d3.mean(filteredData, d => d.Personal_Income_Avg);
        const yMean = d3.mean(filteredData, d => d.Total_Rent_Avg);

        const num = d3.sum(filteredData, d => (d.Personal_Income_Avg - xMean) * (d.Total_Rent_Avg - yMean));
        const den = d3.sum(filteredData, d => Math.pow(d.Personal_Income_Avg - xMean, 2));

        const slope = num / den;
        const intercept = yMean - slope * xMean;

        const xVals = d3.extent(filteredData, d => d.Personal_Income_Avg);
        const yVals = xVals.map(x => slope * x + intercept);

        svg.selectAll(".regression").remove();

        svg.append("line")
            .attr("class", "regression")
            .attr("x1", x(xVals[0]))
            .attr("y1", y(yVals[0]))
            .attr("x2", x(xVals[1]))
            .attr("y2", y(yVals[1]))
            .attr("stroke", "red")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4 2");
    }

    // initial render
    drawPoints();
    drawRegressionLine(data);

    // checkbox interactivity
    d3.selectAll("input[type=checkbox]").on("change", () => {
        const visible = data.filter(d => {
            const checked = d3.select(`input[value='${d.Neighborhood}']`).property("checked");
            return checked;
        });
        drawPoints(+d3.select("#opacitySlider").property("value"));
        drawRegressionLine(visible);
    });

    // opacity slider interactivity
    d3.select("#opacitySlider").on("input", function () {
        const op = +this.value;
        drawPoints(op);
    });
});
