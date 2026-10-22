"use client";
import {lazy,Suspense,useEffect,type ReactNode} from "react";
import {ClassicInvite} from "@/components/classic/ClassicInvite";
const Account=lazy(()=>import("./AffiliateSection").then(m=>({default:m.AffiliateSection})));
// #INVITE-AFFILIATE-UX-1022 (L3): il <title> della route è statico in inglese (metadata di app/invite/page.tsx,
// come su tutto il sito); da qui, a lingua scelta, il titolo della scheda segue la lingua del pannello.
// Next 16 manda i metadata in streaming DOPO l'idratazione, quindi un set una tantum veniva sovrascritto:
// l'observer sul <head> lo riapplica finché il pannello è montato.
const TITLE:Record<string,string>={it:"Invita amici | BetRedge",en:"Invite Friends | BetRedge"};
/** The operational account takes precedence over the restyle. Demo fixtures are never routed here. */
export function InvitePage({classic,affiliate,lang,onSignIn,onRegister,legacy}:{classic:boolean;affiliate:boolean;lang:string;onSignIn:()=>void;onRegister:()=>void;legacy:ReactNode}){
 useEffect(()=>{
  if(typeof document==="undefined"||typeof MutationObserver==="undefined")return;
  const t=TITLE[lang.slice(0,2).toLowerCase()]??TITLE.en;
  const apply=()=>{if(document.title!==t)document.title=t;};
  apply();
  const mo=new MutationObserver(apply);
  mo.observe(document.head,{childList:true,subtree:true,characterData:true});
  return()=>mo.disconnect();
 },[lang]);
 if(affiliate)return <Suspense fallback={<p role="status">{lang==="it"?"Caricamento account affiliato…":"Loading affiliate account…"}</p>}><Account lang={lang} onSignIn={onSignIn} onRegister={onRegister}/></Suspense>;
 return classic?<ClassicInvite lang={lang} v2={false} onSignIn={onSignIn} onRegister={onRegister}/>:legacy;
}
