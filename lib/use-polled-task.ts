'use client';
import {useEffect} from 'react';
/** Each data feed owns its lifetime; profile changes cannot restart unrelated feeds. */
export function usePolledTask(task:()=>Promise<void>,intervalMs:number,enabled=true) {
 useEffect(()=>{
  if(!enabled)return;
  let active=true;
  queueMicrotask(()=>{if(active)void task();});
  const timer=setInterval(()=>{void task();},intervalMs);
  return ()=>{active=false;clearInterval(timer);};
 },[task,intervalMs,enabled]);
}
