import {getNews} from '@/lib/news/read.server';
import {wireFeed} from '@/lib/news/view';
import {noteImage} from '@/lib/news/per-note.server';
import {NewsCredit} from '@/components/news/NewsCredit';
import {connection} from 'next/server';
export const metadata={title:'Image credits · BetRedge',robots:{index:false,follow:true}};
export default async function Credits(){
 await connection();const feed=wireFeed(await getNews(),noteImage);
 return <main style={{maxWidth:800,margin:'100px auto',padding:24}}><a href="/blog#news">← Back to news</a><h1>Image credits</h1><p>News artwork uses archive photography with editorial composition, typography and BetRedge branding. Archive photographs do not necessarily depict the reported event.</p>{feed.state==='ok'?feed.cards.filter(c=>c.image).map(c=><section key={c.guid} style={{margin:'24px 0'}}><h2 style={{fontSize:18}}>{c.note.en.title}</h2><NewsCredit src={c.image!.src} label="Attribution"/></section>):<p>Credits temporarily unavailable. Please try again later.</p>}</main>
}
