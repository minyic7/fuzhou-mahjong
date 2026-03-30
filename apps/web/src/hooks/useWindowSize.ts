import { useState, useEffect } from "react";

interface WindowSize {
  width: number;
  height: number;
}

export function useWindowSize(): WindowSize {
  const [size, setSize] = useState<WindowSize>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      }, 100);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return size;
}
