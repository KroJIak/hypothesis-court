import { useEffect, useRef, useState } from "react";

const TYPEWRITER_INTERVAL_MS = 18;
const TYPEWRITER_CHUNK_SIZE = 4;

export function JudgeVerdict({ answer }) {
  const verdictRef = useRef(null);
  const [visibleAnswer, setVisibleAnswer] = useState("");

  useEffect(() => {
    setVisibleAnswer("");

    if (!answer) {
      return undefined;
    }

    let nextLength = 0;
    const intervalId = window.setInterval(() => {
      nextLength = Math.min(answer.length, nextLength + TYPEWRITER_CHUNK_SIZE);
      setVisibleAnswer(answer.slice(0, nextLength));

      if (nextLength >= answer.length) {
        window.clearInterval(intervalId);
      }
    }, TYPEWRITER_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [answer]);

  useEffect(() => {
    verdictRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [visibleAnswer]);

  return (
    <div ref={verdictRef} className="judge-verdict" aria-live="polite">
      <p>{visibleAnswer}</p>
    </div>
  );
}
