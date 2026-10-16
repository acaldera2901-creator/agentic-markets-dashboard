import {PATH_TO_TAB} from '@/lib/app-tab-paths';
export function isDeskPath(path:string){return path==='/'||path==='/app'||Object.hasOwn(PATH_TO_TAB,path);}
export function hasPublicNavigation(path:string){return !/^\/(admin|api|embed)(\/|$)/.test(path);}
export function lobbyDestination(board:string='featured',filter:string='popular'){
 return '/?'+new URLSearchParams({board,filter}).toString();
}
export function readLobbyDestination(search:string){
 const p=new URLSearchParams(search);const board=p.get('board');const filter=p.get('filter');
 return {board:board==='inplay'||board==='soon'||board==='all'?board:'featured',filter:filter==='football'||filter==='tennis'?filter:'popular'} as const;
}
