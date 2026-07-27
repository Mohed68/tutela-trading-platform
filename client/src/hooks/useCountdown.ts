import React from "react";

export function useCountdown(toIso: string) {
  const [left, setLeft] = React.useState<number>(() => new Date(toIso).getTime() - Date.now());
  
  React.useEffect(() => {
    const id = setInterval(() => setLeft(new Date(toIso).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [toIso]);
  
  const secs = Math.max(0, Math.floor(left/1000));
  const mm = String(Math.floor(secs/60)).padStart(2,"0");
  const ss = String(secs%60).padStart(2,"0");
  
  return { 
    ms: left, 
    label: `${mm}:${ss}`, 
    done: secs <= 0 
  };
}