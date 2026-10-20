"use client";
import {lazy,Suspense,type ReactNode} from "react";
import {ClassicInvite} from "@/components/classic/ClassicInvite";
const Account=lazy(()=>import("./AffiliateSection").then(m=>({default:m.AffiliateSection})));
/** The operational account takes precedence over the restyle. Demo fixtures are never routed here. */
export function InvitePage({classic,affiliate,lang,onSignIn,onRegister,legacy}:{classic:boolean;affiliate:boolean;lang:string;onSignIn:()=>void;onRegister:()=>void;legacy:ReactNode}){
 if(affiliate)return <Suspense fallback={<p role="status">{lang==="it"?"Caricamento account affiliato…":"Loading affiliate account…"}</p>}><Account lang={lang} onSignIn={onSignIn} onRegister={onRegister}/></Suspense>;
 return classic?<ClassicInvite lang={lang} v2={false} onSignIn={onSignIn} onRegister={onRegister}/>:legacy;
}
