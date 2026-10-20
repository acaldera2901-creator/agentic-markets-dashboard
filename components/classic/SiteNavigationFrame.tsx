'use client';
import {usePathname} from 'next/navigation';
import {Fragment,useEffect,useState,type ReactNode} from 'react';
import {CLASSIC} from '@/lib/classic/flag';
import {classicCopy} from '@/lib/classic/lobby-copy';
import {hasPublicNavigation,isDeskPath,lobbyDestination} from '@/lib/classic/site-navigation';
import {ClassicIcon,type ClassicIconName} from './ClassicIcon';
import {SiteNavigationContext,type LobbyNavigationState} from './SiteNavigationContext';
import SiteTopbar from '@/components/world-cup/SiteTopbar';
import './classic-lobby.css';
import './site-navigation.css';
import './mobile-navigation.css';
import {MobileNavigation} from './MobileNavigation';
export default function SiteNavigationFrame({children}:{children:ReactNode}){
 const path=usePathname()??'/';const [lang,setLang]=useState('en');
 const [lobby,setLobby]=useState<LobbyNavigationState|null>(null);
 useEffect(()=>{const read=()=>{try{setLang(localStorage.getItem('agentic-lang')||'en');}catch{}};read();window.addEventListener('agentic-lang-change',read);return()=>window.removeEventListener('agentic-lang-change',read);},[]);
 if(!CLASSIC||!hasPublicNavigation(path))return <>{children}</>;
 const toolsLocale=path.match(/^\/(?:([a-z]{2})\/)?tools(?:\/|$)/);
 const navLang=toolsLocale?(toolsLocale[1]||'en'):lang;
 const headerLang=(['it','es','fr','ru'].includes(navLang)?navLang:'en') as 'it'|'en'|'es'|'fr'|'ru';
 const t=classicCopy(navLang);
 const groups:{title:string;items:[string,string,ClassicIconName][]}[]=[
 {title:t.sideBoard,items:[[lobbyDestination('featured'),t.tabFeatured,'market-soft'],[lobbyDestination('inplay'),t.tabInPlay,'classic-live'],[lobbyDestination('soon'),t.tabSoon,'menu-history'],[lobbyDestination('all'),t.tabAll,'classic-home']]},
 {title:t.sportsLabel,items:[[lobbyDestination('featured','popular'),t.popular,'classic-popular'],[lobbyDestination('all','football'),t.football,'menu-prediction'],[lobbyDestination('all','tennis'),t.tennis,'classic-tennis']]},
 {title:t.sideMore,items:[['/predictions?view=live',t.sideLive,'classic-live'],['/history',t.sideRecord,'market-result'],['/tools',t.b3Tools,'menu-tools'],['/partners',t.sidePartners,'menu-partner'],['/invite',t.sideInvite,'menu-partner']]},
 ];
 const sidebar=<nav className="brc-side br-site-sidebar" aria-label={t.sideLabel}>{groups.map(g=><Fragment key={g.title}><p className="brc-side__h">{g.title}</p><ul className="brc-side__list">{g.items.map(([href,label,icon])=><li key={label}><a href={href} className="brc-side__item" aria-current={href===path||Boolean(lobby&&(g.title===t.sideBoard?new URLSearchParams(href.split('?')[1]).get('board')===lobby.board:g.title===t.sportsLabel?new URLSearchParams(href.split('?')[1]).get('filter')===lobby.filter:false))?'true':undefined}><ClassicIcon name={icon}/><span>{label}</span>{lobby && (label===t.popular||label===t.football||label===t.tennis||label===t.tabInPlay) && <span className="br-site-count">{lobby.loading?'–':label===t.popular?lobby.popular:label===t.football?lobby.football:label===t.tennis?lobby.tennis:lobby.live}</span>}</a></li>)}</ul></Fragment>)}</nav>;
 return <SiteNavigationContext.Provider value={{report:setLobby,sidebar}}><div className="br-site-frame">
 {!isDeskPath(path)&&<SiteTopbar globalNavigation lang={headerLang} hideLang={Boolean(toolsLocale)}/>}
 {isDeskPath(path)?children:<div className="brc-lobby br-site-page">{sidebar}<div className="br-site-content">{children}</div></div>}
 <MobileNavigation groups={groups} lang={navLang}/>
 </div></SiteNavigationContext.Provider>;
}
