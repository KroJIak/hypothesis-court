import { useEffect, useRef, useState } from "react";

const TYPEWRITER_INTERVAL_MS = 18;
const TYPEWRITER_CHUNK_SIZE = 4;
const verdictProgressBySession = new Map();

export function resetJudgeVerdict(sessionId) {
  for (const progressKey of verdictProgressBySession.keys()) {
    if (progressKey.startsWith(`${sessionId}:`)) {
      verdictProgressBySession.delete(progressKey);
    }
  }
}

function getVerdictProgressKey(sessionId, answer) {
  return `${sessionId}:${answer}`;
}

function getInitialVisibleAnswer(sessionId, answer) {
  const cachedLength = verdictProgressBySession.get(getVerdictProgressKey(sessionId, answer)) ?? 0;

  return answer.slice(0, cachedLength);
}

export function JudgeVerdict({ answer, sessionId, onComplete }) {
  const verdictRef = useRef(null);
  const shouldAutoScrollRef = useRef(false);
  const canAutoScrollRef = useRef(false);
  const [visibleAnswer, setVisibleAnswer] = useState(() => getInitialVisibleAnswer(sessionId, answer));

  useEffect(() => {
    shouldAutoScrollRef.current = false;

    if (!answer) {
      setVisibleAnswer("");
      return undefined;
    }

    const progressKey = getVerdictProgressKey(sessionId, answer);
    let nextLength = verdictProgressBySession.get(progressKey) ?? 0;
    canAutoScrollRef.current = nextLength === 0;

    if (nextLength >= answer.length) {
      setVisibleAnswer(answer);
      onComplete?.();
      return undefined;
    }

    setVisibleAnswer(answer.slice(0, nextLength));

    const intervalId = window.setInterval(() => {
      nextLength = Math.min(answer.length, nextLength + TYPEWRITER_CHUNK_SIZE);
      verdictProgressBySession.set(progressKey, nextLength);
      shouldAutoScrollRef.current = canAutoScrollRef.current;
      setVisibleAnswer(answer.slice(0, nextLength));

      if (nextLength >= answer.length) {
        window.clearInterval(intervalId);
        onComplete?.();
      }
    }, TYPEWRITER_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [answer, sessionId]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    verdictRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
    shouldAutoScrollRef.current = false;
  }, [visibleAnswer]);

  return (
    <div ref={verdictRef} className="judge-verdict" aria-live="polite">
      <p>{visibleAnswer}</p>
    </div>
  );
}
