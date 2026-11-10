'use client';
import Image from 'next/image';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {UserRound} from 'lucide-react';
import {HomeAuthModal,type HomeAuthIntent} from '@/components/auth/HomeAuthModal';

type Identity={displayName:string;username:string;avatarUrl:string|null};
export function NewsProfileEntry({lang}:{lang:string}){
 const [identity,setIdentity]=useState<Identity|null>(null),[anonymous,setAnonymous]=useState(false),[intent,setIntent]=useState<HomeAuthIntent|null>(null);
 useEffect(()=>{let live=true;fetch('/api/news/profile',{cache:'no-store'}).then(async r=>{if(!live)return;if(r.status===401){setAnonymous(true);return}if(r.ok){const d=await r.json();if(live)setIdentity(d.profile)}}).catch(()=>{});return()=>{live=false}},[]);
 const it=lang==='it';
 return <div className="ns-profile-entry">
  {anonymous&&<><button type="button" className="ns-entry-login" onClick={()=>setIntent('login')}>{it?'Accedi':'Sign in'}</button><button type="button" className="ns-entry-register" onClick={()=>setIntent('create')}>{it?'Registrati':'Register'}</button></>}
  <Link href="/blog/profile" className="ns-profile-link" aria-label={it?'Il tuo profilo e dashboard':'Your profile and dashboard'}>
   <span className="ns-user-avatar">{identity?.avatarUrl?<Image unoptimized src={identity.avatarUrl} width={36} height={36} alt=""/>:<UserRound size={21}/>}</span>
   <span>{identity?.username?`@${identity.username}`:it?'Il tuo profilo':'Your profile'}</span>
  </Link>
  {intent&&<div className="hv3"><HomeAuthModal newsHero intent={intent} lang={lang} onClose={()=>setIntent(null)} onAuthenticated={()=>{window.location.assign('/blog/profile')}}/></div>}
 </div>
}
