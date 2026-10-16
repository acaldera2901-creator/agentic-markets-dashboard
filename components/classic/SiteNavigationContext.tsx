'use client';
import {createContext,useContext,type ReactNode} from 'react';
export type LobbyNavigationState={board:string;filter:string;loading:boolean;live:number;popular:number;football:number;tennis:number};
export const SiteNavigationContext=createContext<{report:(state:LobbyNavigationState|null)=>void;sidebar:ReactNode}|null>(null);
export const useSiteNavigation=()=>useContext(SiteNavigationContext);

/** Place navigation inside the existing page content, never around its header. */
export function SitePageNavigation({children,disabled=false}:{children:ReactNode;disabled?:boolean}) {
 const navigation=useSiteNavigation();
 if(!navigation||disabled)return <>{children}</>;
 return <div className="brc-lobby br-site-page">{navigation.sidebar}<div className="br-site-content">{children}</div></div>;
}
