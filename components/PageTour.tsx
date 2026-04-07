"use client";

import { useEffect, useState } from "react";
import { SpotlightProvider, SpotlightTour, useSpotlight } from "react-tourlight";
import "react-tourlight/styles.css";

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
}

interface PageTourProps {
  tourId: string;
  steps: TourStep[];
  delay?: number;
}

function storageKey(tourId: string) {
  return `tour_${tourId}_done`;
}

function TourAutoStart({ tourId, delay = 800 }: { tourId: string; delay: number }) {
  const { start } = useSpotlight();

  useEffect(() => {
    const timer = setTimeout(() => {
      start(tourId);
    }, delay);
    return () => clearTimeout(timer);
  }, [tourId, delay, start]);

  return null;
}

export default function PageTour({ tourId, steps, delay = 800 }: PageTourProps) {
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
        steps={steps}
        onComplete={handleComplete}
        onSkip={handleComplete}
      />
      <TourAutoStart tourId={tourId} delay={delay} />
    </SpotlightProvider>
  );
}
