'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Desk query destinations initialize their filters on document load. */
import {useRef,useState} from 'react';
import {Home,Radio,Bookmark,Wrench,Menu,X} from 'lucide-react';
import {ClassicIcon,type ClassicIconName} from './ClassicIcon';
import {classicCopy} from '@/lib/classic/lobby-copy';
type Group={title:string;items:[string,string,ClassicIconName][]};
export function MobileNavigation({groups,lang}:{groups:Group[];lang:string}){
 const dialog=useRef<HTMLDialogElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false);
 const t=classicCopy(lang);
 const close=()=>dialog.current?.close();
 return <>
 <nav className="br-mobile-nav" aria-label={lang==='it'?'Navigazione mobile':'Mobile navigation'}>
 <a href="/"><Home size={21}/><span>Home</span></a>
 <a href="/predictions?view=live"><Radio size={21}/><span>Live</span></a>
 <a href="/predictions?view=watchlist"><Bookmark size={21}/><span>Watchlist</span></a>
 <a href="/tools"><Wrench size={21}/><span>{lang==='it'?'Strumenti':'Tools'}</span></a>
 <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setOpen(true);dialog.current?.showModal();}}><Menu size={21}/><span>Menu</span></button>
 </nav>
 <dialog ref={dialog} className="br-mobile-menu" aria-label="Menu" onClose={()=>{setOpen(false);trigger.current?.focus();}} onClick={e=>{if(e.target===e.currentTarget)close();}}>
 {open && <div className="br-mobile-menu__body">
 <header><strong>BETREDGE</strong><button type="button" autoFocus aria-label={lang==='it'?'Chiudi menu':'Close menu'} onClick={close}><X/></button></header>
 <nav aria-label={lang==='it'?'Tutte le sezioni':'All sections'}>{groups.map(g=><section key={g.title}><h2>{g.title}</h2>{g.items.map(([href,label,icon])=><a key={href} href={href} onClick={close}><ClassicIcon name={icon}/>{label}</a>)}</section>)}<a href="/plans" onClick={close}>{lang==='it'?'Account e abbonamento':'Account & plans'}</a></nav>
 <p className="br-mobile-menu__foot">{t.football} · {t.tennis}</p>
 </div>}
 </dialog>
 </>;
}
