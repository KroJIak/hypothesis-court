import { useEffect, useState } from "react";

import { fetchHealth } from "./api/health";

const initialStatus = {
  label: "Connecting to API...",
  state: "loading",
};

export default function App() {
  const [apiStatus, setApiStatus] = useState(initialStatus);

  useEffect(() => {
    const abortController = new AbortController();

    fetchHealth(abortController.signal)
      .then((payload) => {
        setApiStatus({
          label: `API ${payload.status}`,
          state: "success",
        });
      })
      .catch(() => {
        setApiStatus({
          label: "API unavailable",
          state: "error",
        });
      });

    return () => {
      abortController.abort();
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="hero-card">
        <span className="hero-kicker">Hypothesis Court</span>
        <h1 className="hero-title">мяу</h1>
        <p className={`api-status api-status--${apiStatus.state}`}>{apiStatus.label}</p>
      </section>
    </main>
  );
}
