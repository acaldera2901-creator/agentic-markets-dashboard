'use client';
import {useCallback,useEffect,useRef} from 'react';
import {usePathname} from 'next/navigation';
import {externalReferrerHost,initAttribution,sourceFromSearch} from '@/lib/attribution';
import {trackEvent,anchorSession,syncAnalyticsConsent} from '@/lib/track-event';
import {shouldSkipAnalyticsPath} from '@/lib/analytics-quality';
import {storageGet} from '@/lib/safe-storage';
type Meta=Record<string,unknown>;
export default function PageViewTracker(){
 const pathname=usePathname();
 const enhanced=process.env.NEXT_PUBLIC_ANALYTICS_LINKING_ENABLED==='1';
 const entryView=useRef(true);
 const pendingEntry=useRef<Meta|null>(null);
 const currentView=useRef<Meta|null>(null);
 const lastPath=useRef<string|null>(null);
 const measured=useRef(new WeakSet<Meta>());
 const measure=useCallback((meta:Meta,entry?:Meta)=>{
  if(measured.current.has(meta))return;
  const consent=storageGet('gdpr_consent');
  // The advanced mode waits for a decision; no pre-consent view is back-linked.
  // Entry context alone remains in memory. On acceptance only the current page is measured.
  if(enhanced&&consent!=='accepted'&&consent!=='declined')return;
  measured.current.add(meta);
  if(enhanced&&consent==='accepted'){
   void syncAnalyticsConsent(entry??meta).then(state=>{
    if(state!=='ready'||storageGet('gdpr_consent')!=='accepted')return;
    trackEvent('page_view',{meta});
    if(entry)trackEvent('entry_attributed',{meta:entry});
    anchorSession(entry??meta);
   });
  }else{
   trackEvent('page_view',{meta});anchorSession(meta);
  }
 },[enhanced]);
 useEffect(()=>{
  if(shouldSkipAnalyticsPath(pathname)||lastPath.current===pathname)return;
  lastPath.current=pathname;
  initAttribution();
  const first=entryView.current;entryView.current=false;
  const ref=first?externalReferrerHost():null;
  const meta:Meta={path:pathname.slice(0,512),...sourceFromSearch(window.location.search),...(ref?{ref_host:ref}:{})};
  currentView.current=meta;
  if(first&&storageGet('gdpr_consent')===null)pendingEntry.current=meta;
  measure(meta);
 },[pathname,measure]);
 useEffect(()=>{
  const onConsent=()=>{
   initAttribution();
   const entry=pendingEntry.current;pendingEntry.current=null;
   const consent=storageGet('gdpr_consent');
   if(enhanced){
    if(consent==='accepted'){
     // Consent lifecycle is independent of aggregate page-view deduplication.
     // Reaccepting on the same page still mints/anchors a new consenting session.
     const context=entry??currentView.current??{path:window.location.pathname};
     void syncAnalyticsConsent(context).then(state=>{
      if(state==='ready'&&storageGet('gdpr_consent')==='accepted')anchorSession(context);
     });
    }else void syncAnalyticsConsent(undefined,true);
    if(currentView.current)measure(currentView.current,consent==='accepted'?entry??undefined:undefined);
   }else{
    void syncAnalyticsConsent(entry??{path:window.location.pathname});
    if(entry&&consent==='accepted'){trackEvent('entry_attributed',{meta:entry});anchorSession(entry);}
   }
  };
  const onStorage=(event:StorageEvent)=>{if(event.key==='gdpr_consent'||event.key===null){onConsent();if(!enhanced&&storageGet('gdpr_consent')!=='accepted')void syncAnalyticsConsent(undefined,true);}};
  window.addEventListener('storage',onStorage);window.addEventListener('betredge:gdpr-consent',onConsent);
  return()=>{window.removeEventListener('storage',onStorage);window.removeEventListener('betredge:gdpr-consent',onConsent);};
 },[enhanced,measure]);
 return null;
}
