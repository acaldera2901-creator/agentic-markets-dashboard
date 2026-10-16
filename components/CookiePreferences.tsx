'use client';
import {useState} from 'react';
/** The privacy page exposes withdrawal and re-opening of the existing consent banner. */
export default function CookiePreferences(){
 const [withdrawn,setWithdrawn]=useState(false);
 const withdraw=()=>{
  try{localStorage.setItem('gdpr_consent','declined');sessionStorage.removeItem('am_sid');sessionStorage.removeItem('br_session_anchor');localStorage.removeItem('am_attrib');}catch{/* storage may be blocked */}
  window.dispatchEvent(new Event('betredge:gdpr-consent'));setWithdrawn(true);
 };
 return <div className="flex flex-wrap gap-3 py-2">
  <button type="button" className="border border-[var(--am-line)] px-3 py-2 text-xs" onClick={()=>window.dispatchEvent(new Event('betredge:cookie-settings'))}>Cookie preferences</button>
  <button type="button" className="border border-[var(--am-line)] px-3 py-2 text-xs" onClick={withdraw}>Withdraw analytics consent</button>
  <span role="status" className="text-xs">{withdrawn?'Analytics consent withdrawn.':''}</span>
 </div>;
}
