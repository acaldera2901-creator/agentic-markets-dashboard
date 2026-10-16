'use client';
import {classicCopy} from '@/lib/classic/lobby-copy';
import {trackEvent} from '@/lib/track-event';
import {NavIcon,type NavName} from '@/app/components/menu-icon';
export function ClassicPrimaryNav({lang='en',active=''}:{lang?:string;active?:string}){
 const copy=classicCopy(lang);
 const items:[string,string,NavName,string][]=[['/','Home','home','home'],['/predictions?view=live','Live','live','live'],['/predictions?view=football',copy.football,'football','football'],['/predictions?view=tennis','Tennis','tennis','tennis'],['/tools',lang==='it'?'Strumenti':lang==='fr'?'Outils':lang==='es'?'Herramientas':'Tools','tools','tools']];
 return <nav className="br-nav br-site-primary" aria-label={lang==='it'?'Navigazione principale':'Primary navigation'}>{items.map(([href,label,icon,id])=><a key={id} href={href} onClick={()=>trackEvent("nav_click",{meta:{view:id}})} className="br-nav__item" aria-current={active===id?'page':undefined}><NavIcon name={icon} size={18}/>{label}</a>)}</nav>;
}
