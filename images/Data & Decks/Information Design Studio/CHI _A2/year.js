/* I acknowledge the use of AI. 
Code basic function: plotly chart with 2 trace systems and 3 y-axis => responsive layout with modular annotation groups and traces => event listeners and debounce/re-size
Key creativity: 
1, Checkboxes and dropdown logic using opacity => isolate from plotly toggle easy to manage
2, 2 systems of traces and dummy and y3 dummy axis for add-on informations
3, Hoverinfo: https://community.plotly.com/t/customizing-text-on-x-unified-hovering/39440/11
*/



let processedData;
d3.csv("year view.csv")
    .then(data => {
        // Process data: convert string numbers to actual numbers
        processedData = data.map(d => ({
            day: d.day,
            avg_hvac_work: +d.avg_hvac_work,
            avg_pmv_work: +d.avg_pmv_work,
            scenario_work: +d.scenario_work,
            avg_hvac_break: +d.avg_hvac_break,
            avg_pmv_break: +d.avg_pmv_break,
            scenario_break: +d.scenario_break
        }));
        createControlLegends();
        createPlot();
        // Initial call to update annotations for page 1 after chart is created
        window.updateChartAnnotations(1);
    })
    .catch(error => {
        console.error('Error loading data:', error);
        document.getElementById('chart').innerHTML =
            '<div class="error">Error loading data. Please try again later.</div>';
    });

// Define scenarios
const SCENARIOS = {
    1: {
        color: "#D6F2E2",
        name: "Optimal",
        definition: "✓ Low energy, ✓ High comfort",
        backgroundColor: "rgba(59, 154, 111, 0.3)"
    },
    2: {
        color: "#FDE2E1",
        name: "Inefficient Energy",
        definition: "✗ High energy, ✗ Low comfort",
        backgroundColor: "rgba(251, 47, 47, 0.3)"
    },
    3: {
        color: "#D6A851",
        name: "Thermal Overdrive",
        definition: "✗ High energy, ✓ High comfort",
        backgroundColor: "rgba(255, 202, 105, 0.35)"
    },
    4: {
        color: "#BDBDBD",
        name: "Thermal Neglect",
        definition: "✓ Low energy, ✗ Low comfort",
        backgroundColor: "rgba(189, 189, 189, 0.3)"
    }
};

//Creates and appends scenario legends to the 'scenarioLegends' div.
function createControlLegends() {
    const scenarioLegendsDiv = document.getElementById('scenarioLegends');
    if (scenarioLegendsDiv) {
        Object.entries(SCENARIOS).forEach(([key, value]) => {
            const legendDiv = document.createElement('div');
            legendDiv.className = 'scenario-legend';
            legendDiv.innerHTML = `
                <span class="color-box" style="background: ${value.backgroundColor}"></span>
                <span class="scenario-text">${value.name}: ${value.definition}</span>
            `;
            scenarioLegendsDiv.appendChild(legendDiv);
        });
    } else {
        console.warn("Element with ID 'scenarioLegends' not found. Legends will not be created.");
    }
}


function getResponsiveLayout() {
    const width = window.innerWidth;
    // Define markers for seasons
    const seasonMarkers = [
        { day: 79, label: 'Autumn Equinox' },
        { day: 172, label: 'Winter Solstice' },
        { day: 266, label: 'Spring Equinox' },
        { day: 356, label: 'Summer Solstice' }
    ];
    const pmvThresholdLines = [-0.5, 0.5].map(y => ({
        type: 'line',
        x0: 1, x1: 366, y0: y, y1: y,
        yref: 'y2', layer: 'below',
        line: {
            color: 'rgba(178, 120, 255, 0.97)',
            width: 2.5,
        },
        shape_type: 'static' // Mark as static to distinguish from dynamic annotations
    }));

// Define annotations for season markers and lines
    const seasonAnnotations = seasonMarkers.map(season => ({
        x: season.day,
        y: 2.04,
        xref: 'x',
        yref: 'y3',
        text: season.label,
        showarrow: false,
        font: { size: 13, color: 'rgba(0, 0, 0, 0.75)' },
        annotation_type: 'static' 
    }));

    const seasonLines = seasonMarkers.map(season => ({
        type: 'line',
        x0: season.day,
        x1: season.day,
        y0: 0,
        y1: 2,
        yref: 'y3',
        line: {
            color: 'rgba(0, 0, 0, 0.75)',
            width: 0.85
        },
        shape_type: 'static' 
    }));
// Scenario annotations are static too, they are always there but change opacity
    const staticScenarioAnnotations = annotScenario(0.07, 1.93).map(ann => ({
        ...ann,
        annotation_type: 'static' 
    }));
// main layout designing part
    return {
        width: Math.min(width * 0.95, 1800),// responsive
        height: Math.min(window.innerHeight * 0.7, 600),
        justifyContent: 'center',
        margin: {
            l: 60,
            r: 60,
            t: 20,
            b: 40,
            pad: 4
        },
        font: {
            family: "'Segoe UI', -apple-system, sans-serif",
            size: width > 768 ? 12 : 10
        },
        showlegend: false,
        xaxis: {
            title: "Day of Year",
            range: [1, 366],
            ticktext: ['Jan 15', 'Feb 15', 'Mar 15', 'Apr 15', 'May 15', 'Jun 15',
                'Jul 15', 'Aug 15', 'Sep 15', 'Oct 15', 'Nov 15', 'Dec 15'],
            tickvals: [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349], //data form from moment.js 
            gridcolor: 'rgba(200,200,200,0.2)',
            linecolor: 'rgba(0,0,0,0.3)',
            tickfont: { size: width > 768 ? 12 : 10 },
            type: 'linear',
        },
        yaxis: {
            title: { text: "Energy Usage Score", font: { color: "rgb(35, 126, 165)" } },
            range: [0, 2],
            gridcolor: 'rgba(200,200,200,0.2)',
            linecolor: 'rgba(0,0,0,0.3)',
            tickfont: { size: width > 768 ? 12 : 10, color: "rgb(35, 126, 165)" },
            zeroline: true,
            zerolinecolor: 'gray',
            zerolinewidth: 1,
            zerolinedash: 'dash'
        },
        yaxis2: {
            title: { text: "Thermal Comfort", font: { color: "rgb(154, 53, 37)" } },
            overlaying: "y",
            side: "right",
            range: [-2, 2],
            linecolor: 'rgba(0,0,0,0.3)',
            scaleanchor: "y",
            scaleratio: 0.429,
            tickfont: { size: width > 768 ? 12 : 10, color: "rgb(154, 53, 37)" },
            zeroline: true,
            zerolinecolor: 'gray',
            zerolinewidth: 1,
            zerolinedash: 'dash',
            tickvals: [-2, -1.5, -0.5, 0, 0.5, 1.5, 2],
            ticktext: ["Cool", '-1.5', "-0.5", "0", "+0.5", "1.5", "Warm"],
        },
        yaxis3: {// dummy axis  ( invisible) for balancing the 2 main y axis, and customize hover info
            overlaying: 'y',
            showgrid: false,
            showticklabels: false,
            showline: false,
            zeroline: false,
            visible: false,
        },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
        layer: 'below',
        // Combine static annotations here for initial plot creation
        annotations: [...seasonAnnotations, ...staticScenarioAnnotations],
        shapes: [...seasonLines, ...pmvThresholdLines],
        hovermode: "x unified",
        hoverlabel: {
            bgcolor: "rgba(255,255,255,0.85)",
            font: { color: "#000", size: 11 },
            namelength: -1,
            align: 'left',
        }
    };
}

// work and break notes for scenario colors
function annotScenario(workYCenter, breakYCenter) {
    return [
        {
            x: 0.02, y: workYCenter,
            xref: 'paper', yref: 'y',
            text: 'Break hours',
            showarrow: false,
            font: { size: 12, color: "#000" },
            bgcolor: "rgba(255,255,255,0.9)",
            bordercolor: "#000",
            borderwidth: 0.5,
            borderpad: 3
        },
        {
            x: 0.02, y: breakYCenter,
            xref: 'paper', yref: 'y',
            text: 'Work hours',
            showarrow: false,
            font: { size: 12, color: "#000" },
            bgcolor: "rgba(255,255,255,0.9)",
            bordercolor: "#000",
            borderwidth: 0.5,
            borderpad: 3
        }
    ];
}

// data string to 1 to 365 to comprehensile day formats
function getDayNumber(dateStr) {
    const [day, month] = dateStr.split('/');
    return moment(`2019-${month}-${day}`).dayOfYear();
}

// Helper function to get day number from various date formats
function getDayNumberFromMonthDay(monthDayStr) {
    // This function can parse formats like 'May 1', '05-01', '1/1' for 2019
    const date = moment(monthDayStr + ' 2019', ['MMM D YYYY', 'MM-DD YYYY', 'D/M YYYY']);
    return date.dayOfYear();
}

// format date
function formatDate(dateStr) {
    const [day, month] = dateStr.split('/');
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNum = parseInt(day);
    const monthName = months[parseInt(month) - 1];
    const date = moment(`2019-${month}-${day}`);
    const dayOfWeek = date.format('ddd'); // Gets short day name (Mon, Tue, etc.)
    return `${dayOfWeek}, ${dayNum}${getOrdinalSuffix(dayNum)} ${monthName}`;

    function getOrdinalSuffix(day) {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }
}

// Background trace for scenarios color coding
function createBackgroundTraces() {
    const traces = [];
    processedData.forEach(d => {
        const dayNum = getDayNumber(d.day);

        traces.push({
            x: [dayNum - 0.5, dayNum + 0.5, dayNum + 0.5, dayNum - 0.5],// width
            y: [0, 0, 1.75, 1.75],//upper
            fill: 'toself',
            fillcolor: SCENARIOS[d.scenario_work].backgroundColor,
            type: 'scatter',
            mode: 'none',
            showlegend: false,
            hoverinfo: 'skip',
            yaxis: 'y2'
        });


        traces.push({
            x: [dayNum - 0.5, dayNum + 0.5, dayNum + 0.5, dayNum - 0.5],
            y: [-1.75, -1.75, 0, 0],//lower
            fill: 'toself',
            fillcolor: SCENARIOS[d.scenario_break].backgroundColor,
            type: 'scatter',
            mode: 'none',
            showlegend: false,
            hoverinfo: 'skip',
            yaxis: 'y2'
        });
    });
    return traces;
}
// for hover info
function getPMVCondition(pmv) {
    if (pmv < -0.5) return "Cool";
    if (pmv > 0.5) return "Warm";
    return "Comfortable";
}
function createPlot() {
    const backgroundTraces = createBackgroundTraces();// stacked trace before the line, act independently from lines
    const lineTraces = [

        {
            name: 'HVAC (Work)',
            x: processedData.map(d => getDayNumber(d.day)),
            y: processedData.map(d => d.avg_hvac_work),
            type: 'scatter',
            yaxis: 'y',
            line: { color: '#0041C4', width: 2 },
            opacity: 1,
            hoverinfo: 'text',
            hovertext: processedData.map(d => `HVAC work: ${d.avg_hvac_work.toFixed(2)}`)// I use hover text cuz hovertemplate would automatically shows the x-axis data, which is the 1-365 day of year
        },
        {
            name: 'PMV (Work)',
            x: processedData.map(d => getDayNumber(d.day)),
            y: processedData.map(d => d.avg_pmv_work),
            type: 'scatter',
            yaxis: 'y2',
            line: { color: '#991F1B', width: 2 },
            opacity: 1,
            hoverinfo: 'text',
            hovertext: processedData.map(d => `PMV work: ${d.avg_pmv_work.toFixed(2)} (${getPMVCondition(d.avg_pmv_work)})`)

        },
        {
            name: 'HVAC (Break)',
            x: processedData.map(d => getDayNumber(d.day)),
            y: processedData.map(d => d.avg_hvac_break),
            type: 'scatter',
            yaxis: 'y',
            line: { color: '#3FA9F5', width: 2 },
            opacity: 1,
            hoverinfo: 'text',
            hovertext: processedData.map(d => `HVAC break: ${d.avg_hvac_break.toFixed(2)}`)

        },
        {
            name: 'PMV (Break)',
            x: processedData.map(d => getDayNumber(d.day)),
            y: processedData.map(d => d.avg_pmv_break),
            type: 'scatter',
            yaxis: 'y2',
            line: { color: '#FF6F61', width: 2 },
            opacity: 1,
            hoverinfo: 'text',
            hovertext: processedData.map(d => `PMV break: ${d.avg_pmv_break.toFixed(2)} (${getPMVCondition(d.avg_pmv_break)})`)
        },
        {
            x: processedData.map(d => getDayNumber(d.day)),
            y: Array(processedData.length).fill(2),
            type: 'scatter',
            yaxis: 'y3',
            showlegend: false,
            hoverinfo: 'text',
            text: processedData.map(d => `<b>${formatDate(d.day)} 2019</b>`),
            line: { width: 0 },
            opacity: 0
        },// Dummy y3 for date hover info and height balancing
    ];


    const allTraces = [...backgroundTraces, ...lineTraces];
    const numBackgroundTraces = backgroundTraces.length;// indexing the traces, for opacity control


    Plotly.newPlot('chart', allTraces, getResponsiveLayout());// create plot


    // Scenario dropdown handler
    document.getElementById('scenarioSelect')?.addEventListener('change', function(e) { 
        const selectedScenario = e.target.value;
        let opacities = Array(numBackgroundTraces).fill(0);// Initialize all background opacities to 0


        if (selectedScenario === 'none') {
            opacities = Array(numBackgroundTraces).fill(0); // stay 0 if None is chosen
        } else if (selectedScenario !== 'all') { //If a specific scenario is selected, set opacity to 1 for matching traces
            processedData.forEach((d, i) => {
                const workIndex = i * 2;
                const breakIndex = workIndex + 1;
//  Index for work  and break scenario background trace
                if (d.scenario_work === parseInt(selectedScenario)) {
                    opacities[workIndex] = 1;
                }
                if (d.scenario_break === parseInt(selectedScenario)) {
                    opacities[breakIndex] = 1;
                }
            });
        } else {
            opacities = Array(numBackgroundTraces).fill(1);// else here is All
        }

// // Combine background opacities with line trace opacities
        Plotly.restyle('chart', {
            opacity: [...opacities, ...Array(4).fill(1)]
        });
    });


    // Line visibility checkboxes, indexing 
    const lineCheckboxes = {
        hvacWork: numBackgroundTraces,
        pmvWork: numBackgroundTraces + 1,
        hvacBreak: numBackgroundTraces + 2,
        pmvBreak: numBackgroundTraces + 3
    };

// Attach event listeners to each checkbox
    Object.entries(lineCheckboxes).forEach(([id, traceIndex]) => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', function(e) {
                // Toggle opacity of the corresponding line trace based on checkbox checked state
                Plotly.restyle('chart', {
                    opacity: [e.target.checked ? 1 : 0]
                }, [traceIndex]);
            });
        }
    });
// Debounced window resize event listener for responsive layout updates
    window.addEventListener('resize', debounce(() => {
        Plotly.relayout('chart', getResponsiveLayout());
    }, 250));

}

// Debounce function to limit the rate at which a function is called.
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// New function to update chart annotations
window.updateChartAnnotations = function(pageNum) {
    const chartDiv = document.getElementById('chart');
    if (!chartDiv || !chartDiv.layout) {
        console.warn("Chart not initialized or layout not available for annotation update.");
        return;
    }

    const existingAnnotations = chartDiv.layout.annotations || [];
    const existingShapes = chartDiv.layout.shapes || [];

    // Filter out previously added *page-specific* annotations and shapes, and keep only the static ones
    const staticAnnotations = existingAnnotations.filter(ann => ann.annotation_type === 'static');
    const staticShapes = existingShapes.filter(shape => shape.shape_type === 'static');

    const newPageSpecificAnnotations = [];
    const newPageSpecificShapes = [];

    // Define page-specific annotations and shapes for the current page
    switch (pageNum) {
        case 2:
            const may1 = getDayNumberFromMonthDay('05-01'); const oct10 = getDayNumberFromMonthDay('10-10');
            newPageSpecificShapes.push({
                type: 'rect',
                x0: may1, x1: oct10,
                y0: -0.5, y1: 0.5,
                xref: 'x', yref: 'y2',
                line: { width: 3, color: 'black' },
                fillcolor: 'rgba(174, 125, 125, 0.1)', 
                shape_type: 'dynamic'//mark as dynamic for filtering
            });
            newPageSpecificAnnotations.push({
                text: 'Thanks to natural environment, comfort in this periods is sustained without needing energy use',
                x: (may1 + oct10) / 2, 
                y: 1.45, 
                xref: 'x', yref: 'y2', showarrow: false, font: { size: 17, color: 'black', weight: 'bold' },
                annotation_type: 'dynamic'
            });
            break;
        case 3:
            const jan1 = getDayNumberFromMonthDay('01-01');const mar30 = getDayNumberFromMonthDay('03-30');
            const aug9 = getDayNumberFromMonthDay('08-09'); const oct9 = getDayNumberFromMonthDay('10-09');

            newPageSpecificShapes.push({
                type: 'rect',
                x0: jan1, x1: mar30,
                y0: 0, y1: 1.45,
                xref: 'x', yref: 'y2',
                line: { width: 2, color: 'purple' },
                fillcolor: 'rgba(0,0,255,0.1)',
                shape_type: 'dynamic'
            });
            newPageSpecificShapes.push({
                type: 'rect',
                x0: aug9, x1: oct9,
                y0: -0.5, y1: 0.5,
                xref: 'x', yref: 'y2',
                line: { width: 2, color: 'green' },
                fillcolor: 'rgba(0,255,0,0.1)',
                shape_type: 'dynamic'
            });
            newPageSpecificAnnotations.push({
                text: 'In the purple annotation, energy use is inefficient, as people still feel too warm in the heat of summer. <br> In contrast, the green annotation demonstrate when energy use make PMV grows out of comfort, leaning to the colder side.',
                x: aug9, 
                y: 1.55, 
                xref: 'x', yref: 'y2', showarrow: false, font: { size: 17, color: 'black', weight: 'bold',  },
                annotation_type: 'dynamic'
            });
            break;
     case 4:
            const may7 = getDayNumberFromMonthDay('05-07');  const aug1 = getDayNumberFromMonthDay('08-01');
            newPageSpecificShapes.push({
                type: 'rect',
                x0: may7, x1: aug1,
                y0: -1.55, y1: -0.5,
                xref: 'x', yref: 'y2',
                line: { width: 2, color: 'darkorange' },
                fillcolor: 'rgba(255,165,0,0.1)',
                shape_type: 'dynamic'
            });
                     newPageSpecificShapes.push({
                type: 'rect',
                x0: may7, x1: aug1,
                y0: -0.5, y1: 0.5,
                xref: 'x', yref: 'y2',
                line: { width: 2, color: 'darkgreen' },
                fillcolor: 'rgba(0,128,0,0.1)',
                shape_type: 'dynamic'
            });
            newPageSpecificAnnotations.push({
                text: 'Energy usage during work have spikey lines as the score goes down on weekend.<br> PMV is stable, yet patterns regarding break and work days is still visible',
                x: (may7 + aug1) / 2,
                y: 1.5,
                xref: 'x', yref: 'y2', showarrow: false, font: { size: 17, color: 'black', weight: 'bold',  },
                annotation_type: 'dynamic'
            });
            break;
        case 5:
                     const jan1_p5 = getDayNumberFromMonthDay('01-01'); const apr30_p5 = getDayNumberFromMonthDay('04-30');
            newPageSpecificShapes.push({
                type: 'rect',
                x0: jan1_p5, x1: apr30_p5,
                y0: 1, y1: 1.65,
                xref: 'x', yref: 'y',
                line: { width: 2, color: 'darkblue' },
                fillcolor: 'rgba(0,0,139,0.1)',
                shape_type: 'dynamic'
            });
            newPageSpecificAnnotations.push({
                text: 'PMV get spikey during hotter seasons, with work days being more comfortable<br> as there is the service of HVAC energy, yet it is not enough ...',
                x: (jan1_p5 + apr30_p5) / 2,
                y: 1.75,
                xref: 'x', yref: 'y', showarrow: false, font: { size: 17, color: 'black', weight: 'bold',  },
                annotation_type: 'dynamic'
            });
            break;
        case 6:
            const nov15 = getDayNumberFromMonthDay('11-15');
            newPageSpecificAnnotations.push({
                text: 'Scroll down for Day View',
                x: nov15,
                y: 2.1,
                xref: 'x', yref: 'y2', showarrow: false, font: { size: 16, color: '68bc28', weight: 'bold' },
                annotation_type: 'dynamic'
            });
            break;
    }


    // Combine static annotations with the new page-specific annotations
    const finalAnnotations = [...staticAnnotations, ...newPageSpecificAnnotations];
    const finalShapes = [...staticShapes, ...newPageSpecificShapes];
//redraw
    Plotly.relayout('chart', { annotations: finalAnnotations, shapes: finalShapes });
};