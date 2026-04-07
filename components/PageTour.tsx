"use client";

import { useEffect, useState, useCallback } from "react";
import { SpotlightProvider, SpotlightTour, useSpotlight } from "react-tourlight";
import "react-tourlight/styles.css";

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
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

  const tryStart = useCallback(() => {
    const allExist = targets.every((sel) => document.querySelector(sel));
    if (allExist) {
      requestAnimationFrame(() => {
        start(tourId);
      });
      return true;
    }
    return false;
  }, [tourId, targets, start]);

  useEffect(() => {
    if (tryStart()) return;

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (tryStart() || attempts > 20) {
        clearInterval(interval);
      }
    }, 300);

    return () => clearInterval(interval);
  }, [tryStart]);

  return null;
}

export default function PageTour({ tourId, steps }: PageTourProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem(storageKey(tourId));
      if (!done) setShow(true);
    } catch {
      // localStorage not available
    }
  }, [tourId]);

  function handleComplete() {
    try {
      localStorage.setItem(storageKey(tourId), "true");
    } catch {
      // ignore
    }
    setShow(false);
  }

  if (!show) return null;

  const stepsWithPadding = steps.map((s) => ({
    ...s,
    spotlightPadding: s.spotlightPadding ?? 10,
    spotlightRadius: 16,
  }));

  const targets = steps.map((s) => s.target);

  return (
    <SpotlightProvider
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
        onComplete={handleComplete}
        onSkip={handleComplete}
      />
      <TourAutoStart tourId={tourId} targets={targets} />
    </SpotlightProvider>
  );
}
