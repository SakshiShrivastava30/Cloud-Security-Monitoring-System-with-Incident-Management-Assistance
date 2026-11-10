
import Panel from "./panel";
import SecurityFeed from "./SecurityFeed";

function MiniChart() {
  const series = [
    {
      color: "#ff4149",
      points: "0,112 25,105 50,100 75,88 100,83 125,67 150,80 175,91 200,72 225,50 250,12 275,2 300,24 325,48 350,39 375,53 400,70 425,76 450,66 475,78 500,91 525,82 550,93",
    },
    {
      color: "#ffbd13",
      points: "0,124 25,121 50,117 75,112 100,114 125,106 150,119 175,114 200,102 225,106 250,96 275,100 300,111 325,119 350,113 375,115 400,108 425,114 450,120 475,114 500,118 525,111 550,117",
    },
    {
      color: "#129bff",
      points: "0,142 25,139 50,142 75,136 100,141 125,134 150,140 175,138 200,144 225,135 250,125 275,130 300,139 325,143 350,135 375,141 400,136 425,142 450,140 475,145 500,138 525,142 550,138",
    },
  ];

  return (
    <svg viewBox="0 0 550 190" className="cm-chart">
      {[20, 50, 80, 110, 140, 170].map((y) => (
        <line key={y} x1="0" y1={y} x2="550" y2={y}
          stroke="#123149" strokeWidth="1" />
      ))}

      {[0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550].map((x) => (
        <line key={x} x1={x} y1="15" x2={x} y2="170"
          stroke="#102b41" strokeWidth="1" />
      ))}

      {series.map((line) => (
        <polyline
          key={line.color}
          points={line.points}
          transform="translate(0 18)"
          fill="none"
          stroke={line.color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"].map(
        (time, i) => (
          <text key={time} x={i * 91} y="187"
            fill="#91a9c4" fontSize="10">
            {time}
          </text>
        )
      )}
    </svg>
  );
}

function SeverityChart() {
  const legend = [
    ["#ff343c", "Critical", "4 (14%)"],
    ["#ff8a00", "High", "8 (29%)"],
    ["#ffd21a", "Medium", "10 (36%)"],
    ["#168dff", "Low", "6 (21%)"],
  ];

  return (
    <div className="cm-severity-content">
      <div className="cm-donut">
        <div>
          <strong>28</strong>
          <span>Total</span>
        </div>
      </div>

      <div className="cm-legend">
        {legend.map(([color, label, value]) => (
          <div className="cm-legend-row" key={label}>
            <i style={{ background: color }} />
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardCharts() {
  return (
    <div className="cm-grid-top">

      <Panel title="Security Threat Activity">
        <div className="cm-chart-legend">
          <span><i style={{ background: "#ff4149" }} />Critical</span>
          <span><i style={{ background: "#ff8a00" }} />High</span>
          <span><i style={{ background: "#ffd21a" }} />Medium</span>
          <span><i style={{ background: "#168dff" }} />Low</span>
        </div>
        <MiniChart />
      </Panel>

      <Panel title="Incidents by Severity">
        <SeverityChart />
      </Panel>

      <SecurityFeed />

    </div>
  );
}

export default DashboardCharts;
