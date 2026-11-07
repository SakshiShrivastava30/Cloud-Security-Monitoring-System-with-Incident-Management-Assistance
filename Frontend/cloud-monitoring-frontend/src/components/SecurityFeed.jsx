
import Panel from "./asset-inventory/panel";

const feed = [
  {
    color: "red",
    title: "Suspicious API activity detected",
    detail: "From IP 192.168.1.45",
    time: "2 min ago",
  },
  {
    color: "orange",
    title: "Unauthorized access attempt",
    detail: "on AWS EC2 instance",
    time: "5 min ago",
  },
  {
    color: "red",
    title: "High severity vulnerability found",
    detail: "in payment-service",
    time: "12 min ago",
  },
  {
    color: "green",
    title: "New user login",
    detail: "User account activity",
    time: "18 min ago",
  },
  {
    color: "orange",
    title: "Compliance policy violated",
    detail: "Data encryption disabled",
    time: "25 min ago",
  },
];

function SecurityFeed() {
  return (
    <Panel
      title="Live Security Feed"
      action="View All"
      className="cm-feed-panel"
    >
      <div className="cm-feed-list">
        {feed.map((item) => {
          const dotColor =
            item.color === "red"
              ? "#ff303c"
              : item.color === "orange"
              ? "#ff8b19"
              : "#00dfaa";

          return (
            <div className="cm-feed-item" key={item.title}>
              <span
                className="cm-feed-dot"
                style={{
                  background: dotColor,
                  color: dotColor,
                }}
              />

              <div>
                <p>{item.title}</p>
                <small>{item.detail}</small>
              </div>

              <span className="cm-feed-time">
                {item.time}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export default SecurityFeed;
