/* I acknowledge the use of AI. 
Code basic functions: Group data by day, sort day, plot chart with scenarios, annotations, layouts, etc, plotly react to update chart by day. Add highlighted days and scenario legends.
Key creativity ( not AI ): day grouping, date handling, 2 layers of traces, and slider usage*/

d3.csv("24hr daily.csv").then(data => {
    // Define the different scenarios
    const SCENARIOS = {
        Optimal: {
            color: "rgba(59, 154, 111, 0.3)", 
            definition: "✓ Low energy, ✓ High comfort"
        },
        Inefficient_Energy: {
            color: "rgba(220, 38, 38, 0.3)", 
            definition: "✗ High energy, ✗ Low comfort"
        },
        Thermal_Overdrive: {
            color: "rgba(228, 181, 94, 0.35)", 
            definition: "✓ High comfort, ✗ High energy"
        },
        Thermal_Neglect: {
            color: "rgba(189, 189, 189, 0.3)", 
            definition: "✗ Low comfort, ✓ Low energy"
        }
    };

    // parse data to number
    function cleanData(d) {
        d.time = +d.time; 
        d.avg_pmv = +d.avg_pmv; 
        d.avg_hvac = +d.avg_hvac; 
        // Convert scenario flags to boolean
        Object.keys(SCENARIOS).forEach(k => d[k] = d[k] === "1");
        return d;
    }

    // Process all data rows
    data.forEach(cleanData);
    // Group data by day for easy access when changing slider value
    const groupedDataByDay = d3.group(data, d => d.day);

    // Extract unique sorted days to manage the slider range
    const sortedDays = Array.from(groupedDataByDay.keys()).sort((a, b) => {
        // Custom sorting for DD/MM/YYYY date strings
        const [dayA, monthA, yearA] = a.split('/').map(Number);
        const [dayB, monthB, yearB] = b.split('/').map(Number);
        if (yearA !== yearB) return yearA - yearB;
        if (monthA !== monthB) return monthA - monthB;
        return dayA - dayB;
    });

    // Define specific days to highlight 
    const highlightNodes = [
        { day: "17/02/2019", label: "17th Feb: A Summer Sunday" },
        { day: "26/06/2019", label: "26th Jun: A Winter Wednesday" },
        { day: "07/05/2019", label: "7th May: A Typical Tuesday in Fall" },
        { day: "05/10/2019", label: "5th Oct: A Spring Saturday" }
    ];

    // Map highlight nodes in the day array
    const highlightIndices = highlightNodes.map(point => ({
        index: sortedDays.indexOf(point.day),
        label: point.label
    })).filter(point => point.index !== -1); // Filter out any days not found

    // Formats a date string
    function formatDate(dayString) {
        const date = moment(dayString, "DD/MM/YYYY");
        return `${date.format('dddd')}, ${date.format('MMMM')} ${date.date()}${getOrdinalSuffix(date.date())}, ${date.year()}`;
    }
    function getOrdinalSuffix(day) {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

  //annotations
    function createAnnotations(currentDate, scenarioHours) {
        return [
            {
                xref: "paper", yref: "y2",
                x: 0.97, y: 0,
                text: "Comfortable",
                textangle: 90, // Rotate text
                showarrow: false,
                font: { size: 10, color: "#3498db" },
                bgcolor: "rgba(255,255,255,0.3)",
                bordercolor: "#3498db",
                borderwidth: 0.5,
                borderpad: 3
            },
            {
                xref: "paper", yref: "paper", 
                x: 0.03, y: 1.07, 
                // Construct text showing scenario hours, filtering out scenarios with 0 hours
                text: `${currentDate}: ${Object.entries(scenarioHours)
                    .filter(([_, hours]) => hours > 0)
                    .map(([scenario, hours]) => `${scenario.replace(/_/g, ' ')} ${hours}h`)
                    .join(" | ")}`,
                showarrow: false,
                font: { size: 14, color: "#2980b9" },
                bgcolor: "#FAFAFA",
                bordercolor: "#c0392b",
                borderpad: 3
            }
        ];
    }

    function createComfortBand() {
        return {
            type: "rect",
            xref: "paper", x0: 0, x1: 1, // Spans the entire x-axis width
            yref: "y2", y0: -0.5, y1: 0.5, // Spans the comfort range on y2-axis
            fillcolor: "rgba(103, 78, 173, 0.15)", // Light purple fill
            opacity: 1,
            line: { width: 0 }, // No border line
            layer: "below" // Render below traces
        };
    }

    ///Creates background color shapes
    function createScenarioShapes(dayData) {
        // Flatten the array of shapes for each hour
        return dayData.flatMap(d =>
            Object.entries(SCENARIOS)
                .filter(([k]) => d[k]) // Filter for the scenario that is true for the current hour
                .map(([_, { color }]) => ({
                    type: "rect",
                    x0: d.time - 0.5, // Start of the hour
                    x1: d.time + 0.5, // End of the hour
                    y0: 0,
                    y1: 1,
                    yref: "paper", 
                    fillcolor: color,
                    opacity: 1,
                    line: { width: 0 },
                    layer: "below"
                }))
        );
    }

    function createLayout(dayData, currentDate) {
        // Calculate the number of hours spent in each scenario for the current day
        const scenarioHours = Object.fromEntries(
            Object.keys(SCENARIOS).map(k => [k, dayData.filter(d => d[k]).length])
        );

        return {
            width: undefined, // width responsive
            autosize: true,
            height: 350,
            margin: { l: 50, r: 60, t: 20, b: 50 },
            paper_bgcolor: 'white',
            plot_bgcolor: 'white',
            font: {
                family: "'Segoe UI', -apple-system, sans-serif",
                size: window.innerWidth > 768 ? 12 : 10 // Responsive font size
            },
            showlegend: true,
            legend: {
                orientation: 'h', 
                yanchor: 'top', y: 1.23, 
                xanchor: 'center', x: 0.5 
            },
            xaxis: {
                title: { text: "Hours of the Day", font: { color: "#2B2B2B" } },
                range: [-0.1, 23.1], // Full 24-hour range
                dtick: 1, // Tick every hour
                zeroline: false
            },
            yaxis: {
                title: { text: "Energy Usage Score", font: { color: "#3498db" } },
                tickfont: { color: "#3498db" },
                range: [0, 2],
                zeroline: false
            },
            yaxis2: {
                title: { text: "Thermal Comfort", font: { color: "#c0392b" } },
                tickfont: { color: "#c0392b" },
                overlaying: "y", 
                side: "right", 
                range: [-1.75, 1.75], 
                zeroline: false,
                tickvals: [-1.75, -1.5, -0.5, 0, 0.5, 1.5, 1.75], 
                ticktext: ["Cool", "-1.5", "-0.5", "0", "+0.5", "1.5", "Warm"] // Custom tick labels
            },
            // Combine scenario background shapes and the comfort band
            shapes: [...createScenarioShapes(dayData), createComfortBand()],
            hovermode: "x unified", // Show hover info for all traces at a given x-coordinate
            // Add dynamic annotations for date and scenario hours
            annotations: createAnnotations(currentDate, scenarioHours),
            hoverlabel: {
                bgcolor: "rgba(255,255,255,0.85)",
                font: { color: "#000", size: 11 }
            }
        };
    }

      function createTraces(dayData) {
        return [
            {
                x: dayData.map(d => d.time),
                y: dayData.map(d => d.avg_hvac),
                name: "HVAC",
                type: "scatter",
                mode: "lines+markers",
                line: { color: "#2980b9", width: 3, shape: 'hv' }, // Stepped line for HVAC
                marker: { size: 6, symbol: 'diamond' },
                yaxis: "y",
                hovertemplate: "HVAC: %{y:.2f} point<extra></extra>" 
            },
            {
                x: dayData.map(d => d.time),
                y: dayData.map(d => d.avg_pmv),
                name: "PMV",
                type: "scatter",
                mode: "lines+markers",
                line: { color: "#c0392b", width: 3, shape: 'spline' }, // Smooth line for PMV
                marker: { size: 6, symbol: 'circle' },
                yaxis: "y2",
                hovertemplate: "PMV: %{y:.2f} (%{customdata})<extra></extra>", 
                customdata: dayData.map(d => // Custom data for hover text (comfort condition)
                    d.avg_pmv < -0.5 ? "Too Cool" :
                    d.avg_pmv > 0.5 ? "Too Warm" : "Comfortable"
                )
            }
        ];
    }

     function createSlider() {
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'slider-container';

        const dateLabel = document.createElement('div');
        dateLabel.id = 'sliderLabel'; // Display the current date
        sliderContainer.appendChild(dateLabel);

        const sliderWrapper = document.createElement('div');
        sliderWrapper.className = 'slider-wrapper';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = sortedDays.length - 1; // Max value is the last day's index
        slider.value = 0; // Start at the first day
        slider.addEventListener('input', function() {
            plotDay(+this.value); // Re-plot the chart when slider value changes
        });

        sliderWrapper.appendChild(slider);
        sliderContainer.appendChild(sliderWrapper);
        addSliderHighlightNodes(sliderWrapper); // Add specific day markers to the slider

        return sliderContainer;
    }

    function addSliderHighlightNodes(sliderWrapper) {
        if (highlightIndices.length === 0) {
            return;
        }

        highlightIndices.forEach(point => {
            if (point.index !== -1) {
                const node = document.createElement('div');
                node.className = 'slider-node';

                // Calculate position of the node on the slider track
                const position = (point.index / (sortedDays.length - 1)) * 100;
                node.style.left = `${position}%`;

                // Apply styling for the node 
                node.style.position = 'absolute';
                node.style.top = '50%';
                node.style.transform = 'translate(-50%, -50%)';
                node.style.width = '12px';
                node.style.height = '12px';
                node.style.backgroundColor = 'rgb(85, 162, 73)'; 
                node.style.borderRadius = '50%';
                node.style.border = '2px solid white';
                node.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
                node.style.cursor = 'help';
                node.style.zIndex = '2';

                // Create a custom tooltip for the node
                const customTooltip = document.createElement('span');
                customTooltip.className = 'node-tooltip';
                customTooltip.textContent = point.label;
                node.appendChild(customTooltip);

                // Apply styling for the tooltip
                customTooltip.style.visibility = 'hidden'; 
                customTooltip.style.width = 'max-content';
                customTooltip.style.backgroundColor = 'rgba(50, 50, 50, 0.9)';
                customTooltip.style.color = '#fff';
                customTooltip.style.textAlign = 'center';
                customTooltip.style.borderRadius = '6px';
                customTooltip.style.padding = '5px 8px';
                customTooltip.style.position = 'absolute';
                customTooltip.style.zIndex = '10';
                customTooltip.style.bottom = 'calc(100% + 10px)'; 
                customTooltip.style.left = '50%';
                customTooltip.style.transform = 'translateX(-50%)';
                customTooltip.style.opacity = '0'; // Hidden by default
                customTooltip.style.transition = 'opacity 0.3s ease, bottom 0.3s ease'; // Smooth transition for hover
                customTooltip.style.fontSize = '0.85em';
                customTooltip.style.pointerEvents = 'none'; // Allow clicks to pass through
                customTooltip.style.whiteSpace = 'nowrap'; // Prevent text wrapping

                // Add event listeners for showing/hiding tooltip on hover
                node.addEventListener('mouseenter', () => {
                    customTooltip.style.visibility = 'visible';
                    customTooltip.style.opacity = '1';
                    customTooltip.style.bottom = 'calc(100% + 18px)'; // Move up slightly on hover
                });
                node.addEventListener('mouseleave', () => {
                    customTooltip.style.visibility = 'hidden';
                    customTooltip.style.opacity = '0';
                    customTooltip.style.bottom = 'calc(100% + 10px)'; // Move back down on mouse leave
                });

                sliderWrapper.appendChild(node);
            }
        });
    }

     function createLegend(container) {
        const legend = container
            .style("width", "calc(100% - 4rem)")
            .style("margin", "0 auto 1rem")
            .style("display", "flex")
            .style("flex-wrap", "wrap")
            .style("justify-content", "center")
            .style("gap", "20px")
            .style("padding", "0.75rem 1rem")
            .style("background", "white")
            .style("border-radius", "8px")
            .style("box-shadow", "0 2px 8px rgba(0,0,0,0.06)");

        // Iterate through each scenario to create a legend item
        for (const [label, { color, definition }] of Object.entries(SCENARIOS)) {
            const item = legend.append("div")
                .style("display", "flex")
                .style("align-items", "center")
                .style("gap", "8px");

            // Color box for the scenario
            item.append("div")
                .style("width", "12px")
                .style("height", "12px")
                .style("background-color", color)
                .style("border-radius", "2px")
                .style("border", "1px solid rgba(0,0,0,0.1)");

            // Text container for scenario name and definition
            const textContainer = item.append("div")
                .style("display", "flex")
                .style("flex-direction", "column")
                .style("line-height", "1.2");

            textContainer.append("span")
                .style("font-size", "0.85rem")
                .style("font-weight", "600")
                .style("color", "#2c3e50")
                .text(label.replace(/_/g, ' ')); // Replace underscores for readability

            textContainer.append("span")
                .style("font-size", "0.8rem")
                .style("color", "#666")
                .text(definition);
        }
    }

    // Plots the daily HVAC and PMV data for a given day index=> core code

    function plotDay(index) {
        const dayData = groupedDataByDay.get(sortedDays[index]); // Get data for the selected day
        const currentDate = formatDate(sortedDays[index]); // Get formatted date

        Plotly.newPlot("hrdaily",
            createTraces(dayData), 
            createLayout(dayData, currentDate) 
        );

        // Update the date label above the slider
        d3.select("#sliderLabel").text(currentDate);
    }

    // Initializes the daily view by adding the slider and legend to the DOM,plots the first day
    function initializeDayView() {
        const chartContainer = document.querySelector('#hrdaily').parentNode;
        if (!chartContainer) {
            console.error("Chart container #hrdaily parent not found.");
            return;
        }

        // Create and insert the slider above the chart
        const sliderContainer = createSlider();
        chartContainer.insertBefore(sliderContainer, document.querySelector('#hrdaily'));

        // Create and insert the legend above the chart, below the slider
        const legendContainer = d3.select(chartContainer)
            .insert("div", "#hrdaily")
            .attr("class", "day-scenarios"); // Assign a class for styling

        createLegend(legendContainer); // Populate the legend
        plotDay(0); // Plot the data for the first day initially
    }

    // Call the initialization function when the script loads
    initializeDayView();

    // Add a debounced resize event listener to re-layout the chart on window resize
    window.addEventListener('resize', debounce(() => {
        // Re-plot the current day to adjust layout for new window size
        plotDay(document.querySelector('input[type="range"]').value);
    }, 250)); // Debounce to prevent excessive re-plotting during resizing
});


function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout); // Clear previous timeout to reset the timer
        timeout = setTimeout(later, wait); // Set new timeout
    };
}