'use client';
import {createContext,useContext} from 'react';
export type LobbyNavigationState={board:string;filter:string;loading:boolean;live:number;popular:number;football:number;tennis:number};
export const SiteNavigationContext=createContext<{report:(state:LobbyNavigationState|null)=>void}|null>(null);
export const useSiteNavigation=()=>useContext(SiteNavigationContext);
