const ease=t=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};

// Keep the complete interface visible before, during and just after an action.
export function detailVisibility(frame,fps,points){
  const seconds=frame/fps;let wide=0;
  for(const point of points){
    const time=seconds-point.timeMs/1000;
    const enter=ease((time+.65)/.45);
    const leave=1-ease((time-.75)/.5);
    wide=Math.max(wide,enter*leave);
  }
  return 1-wide;
}
