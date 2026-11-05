'use client';
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Heart,MessageCircle,Send,Bookmark,Trash2} from 'lucide-react';
import {HomeAuthModal} from '@/components/auth/HomeAuthModal';
type Comment={id:string;body:string;name:string;created_at:string;mine:boolean};
type Community={likes:number;commentCount:number;liked:boolean;authenticated:boolean;comments:Comment[]};
const subscribeBookmarks=(notify:()=>void)=>{window.addEventListener('storage',notify);window.addEventListener('news-bookmarks',notify);return()=>{window.removeEventListener('storage',notify);window.removeEventListener('news-bookmarks',notify)}};
export function NewsActions({guid,title,lang}:{guid:string;title:string;lang:string}){
 const it=lang==='it';const host=useRef<HTMLDivElement>(null);
 const [data,setData]=useState<Community|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[body,setBody]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[login,setLogin]=useState(false);
 const saved=useSyncExternalStore(subscribeBookmarks,useCallback(()=>{try{return localStorage.getItem('news-saved:'+guid)==='1'}catch{return false}},[guid]),()=>false);
 const requestId=useRef<string|null>(null);
 const unavailable=it?'Interazioni temporaneamente non disponibili. Riprova.':'Interactions temporarily unavailable. Please retry.';
 const load=useCallback(async()=>{const r=await fetch('/api/news/community?guid='+guid,{cache:'no-store'});if(!r.ok)throw Error('unavailable');const d=await r.json() as Community;setData(d);return d},[guid]);
 useEffect(()=>{let live=true;const fetchData=()=>load().catch(()=>{if(live)setError(unavailable)});if(!('IntersectionObserver' in window)){void fetchData();return()=>{live=false}}const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();void fetchData()}},{rootMargin:'500px'});if(host.current)observer.observe(host.current);return()=>{live=false;observer.disconnect()}},[guid,load,unavailable]);
 async function mutate(action:string,extra:Record<string,unknown>){
  if(busy)return;setBusy(true);setError('');
  try{const r=await fetch('/api/news/community',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({guid,action,...extra})});if(r.status===401){setLogin(true);return}if(r.status===429){setError(it?'Aspetta un minuto prima di un altro commento.':'Please wait a minute before posting another comment.');return}if(!r.ok)throw Error();if(action==='comment'){setBody('');requestId.current=null}await load()}catch{setError(unavailable)}finally{setBusy(false)}
 }
 async function share(){const url=location.origin+'/blog#post-'+guid;try{if(navigator.share)await navigator.share({title,url});else{await navigator.clipboard.writeText(url);setNotice(it?'Link copiato':'Link copied')}}catch(e){if((e as Error).name!=='AbortError')setNotice(url)}}
 function bookmark(){try{localStorage.setItem('news-saved:'+guid,saved?'0':'1');window.dispatchEvent(new Event('news-bookmarks')); setNotice(it?'Preferenza salvata su questo dispositivo.':'Saved on this device.')}catch{setNotice(it?'Salvataggio non disponibile.':'Saving unavailable.')}}
 return <div ref={host} className="ns-community">
  <div className="ns-actions">
   <button type="button" aria-label={data?.liked?(it?'Non mi piace più':'Unlike'):(it?'Mi piace':'Like')} aria-pressed={!!data?.liked} disabled={busy||!data} className={data?.liked?'is-liked':''} onClick={()=>void mutate('like',{liked:!data?.liked})}><Heart size={23} fill={data?.liked?'currentColor':'none'}/><span>{data?.likes??'—'}</span></button>
   <button type="button" aria-label={it?'Commenti':'Comments'} aria-expanded={open} aria-controls={'comments-'+guid} onClick={()=>{setOpen(!open);void load().catch(()=>setError(unavailable))}}><MessageCircle size={23}/><span>{data?.commentCount??'—'}</span></button>
   <button type="button" aria-label={it?'Condividi':'Share'} onClick={()=>void share()}><Send size={22}/></button>
   <button type="button" className="ns-save" aria-label={it?'Salva su questo dispositivo':'Save on this device'} aria-pressed={saved} onClick={bookmark}><Bookmark size={22} fill={saved?'currentColor':'none'}/></button>
  </div>
  {notice&&<p className="ns-feedback" role="status">{notice}</p>}
  {error&&<p className="ns-feedback" role="alert">{error} <button type="button" onClick={()=>{setError('');void load().catch(()=>setError(unavailable))}}>{it?'Riprova':'Retry'}</button></p>}
  {open&&<section className="ns-comments" id={'comments-'+guid} aria-label={it?'Commenti':'Comments'}>
   <h4>{it?'La conversazione':'The conversation'}</h4>
   {data?.comments.length===0&&<p className="ns-empty">{it?'Nessun commento. Inizia la conversazione.':'No comments yet. Start the conversation.'}</p>}
   {data&&data.commentCount>50&&<p className="ns-empty">{it?'Ultimi 50 commenti':'Latest 50 comments'}</p>}
   <ul>{data?.comments.map(c=><li key={c.id}><span className="ns-comment-avatar" aria-hidden="true">{c.name.slice(0,1).toUpperCase()}</span><div><strong>{c.name}</strong><p>{c.body}</p><time dateTime={c.created_at}>{new Date(c.created_at).toLocaleString(lang,{dateStyle:'short',timeStyle:'short'})}</time></div>{c.mine&&<button type="button" disabled={busy} aria-label={it?'Elimina commento':'Delete comment'} onClick={()=>void mutate('delete',{id:c.id})}><Trash2 size={15}/></button>}</li>)}</ul>
   {data?.authenticated?<form onSubmit={e=>{e.preventDefault();requestId.current??=crypto.randomUUID();void mutate('comment',{body,id:requestId.current})}}><label className="ns-sr" htmlFor={'comment-'+guid}>{it?'Aggiungi un commento':'Add a comment'}</label><textarea id={'comment-'+guid} value={body} onChange={e=>{setBody(e.target.value);requestId.current=null}} maxLength={1000} rows={2} placeholder={it?'Cosa ne pensi?':'What do you think?'} required/><button disabled={busy||!body.trim()} type="submit">{busy?(it?'Invio…':'Posting…'):(it?'Pubblica':'Post')}</button></form>:<button type="button" className="ns-login" onClick={()=>setLogin(true)}>{it?'Accedi per partecipare':'Sign in to join the conversation'}</button>}
  </section>}
  {login&&<div className="hv3"><HomeAuthModal intent="login" lang={lang} onClose={()=>setLogin(false)} onAuthenticated={()=>{setLogin(false);void load().catch(()=>setError(unavailable))}}/></div>}
 </div>
}
