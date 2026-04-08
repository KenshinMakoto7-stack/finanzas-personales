"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { SpotlightProvider, SpotlightTour, useSpotlight, type TourState } from "react-tourlight";
import "react-tourlight/styles.css";

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right" | "auto";
  spotlightPadding?: number;
}

interface PageTourProps {
  tourId: string;
  steps: TourStep[];
}

function storageKey(tourId: string) {
  return `tour_${tourId}_done`;
}

function TourAutoStart({ tourId, targets }: { tourId: string; targets: string[] }) {
  const { start } = useSpotlight();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (attempts > 30) {
        clearInterval(interval);
        return;
      }
      const allExist = targets.every((sel) => document.querySelector(sel));
      if (allExist && !startedRef.current) {
        startedRef.current = true;
        clearInterval(interval);
        requestAnimationFrame(() => start(tourId));
      }
    }, 400);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function PageTour({ tourId, steps }: PageTourProps) {
  const [show, setShow] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem(storageKey(tourId));
      if (!done) setShow(true);
    } catch {
      // localStorage not available
    }
  }, [tourId]);

  const markDone = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    try {
      localStorage.setItem(storageKey(tourId), "true");
    } catch {
      // ignore
    }
    setShow(false);
  }, [tourId]);

  const handleStateChange = useCallback(
    (id: string, state: TourState) => {
      if (id === tourId && state.status !== "active") {
        markDone();
      }
    },
    [tourId, markDone]
  );

  const stepsWithPadding = useMemo(
    () =>
      steps.map((s) => ({
        ...s,
        spotlightPadding: s.spotlightPadding ?? 10,
        spotlightRadius: 16,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(steps)]
  );

  const targets = useMemo(
    () => stepsWithPadding.map((s) => s.target as string),
    [stepsWithPadding]
  );

  if (!show) return null;

  return (
    <SpotlightProvider
      onStateChange={handleStateChange}
      labels={{
        next: "Siguiente",
        previous: "Anterior",
        skip: "Saltar",
        done: "Entendido",
        close: "Cerrar",
        stepOf: (current, total) => `${current} de ${total}`,
      }}
    >
      <SpotlightTour
        id={tourId}
        steps={stepsWithPadding}
        onComplete={markDone}
        onSkip={markDone}
      />
      <TourAutoStart tourId={tourId} targets={targets} />
    </SpotlightProvider>
  );
}
