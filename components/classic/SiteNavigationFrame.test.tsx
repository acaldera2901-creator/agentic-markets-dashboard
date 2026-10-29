import {vi,describe,it,expect} from 'vitest';
import {render,screen,within} from '@testing-library/react';
import SiteNavigationFrame from './SiteNavigationFrame';
import {ClassicPrimaryNav} from './ClassicPrimaryNav';
import {SitePageNavigation} from './SiteNavigationContext';
import {ClassicLobby} from './ClassicLobby';
let pathname='/tools';
vi.mock('next/navigation',()=>({usePathname:()=>pathname,useRouter:()=>({push:vi.fn(),back:vi.fn()})}));
vi.mock('@/lib/classic/flag',()=>({CLASSIC:true}));
vi.mock('@/lib/track-event',()=>({trackEvent:vi.fn()}));
vi.mock('@/components/world-cup/SiteTopbar',()=>({default:()=> <div data-testid="shared-header"/>}));
vi.mock('next/link',()=>({default:({href,children}:{href:string;children:React.ReactNode})=><a href={href}>{children}</a>}));
let newsFeed:{state:string}|null=null;
vi.mock('@/components/news/use-news',()=>({useNewsFeed:()=>newsFeed,useNow:()=>null}));
describe('public site navigation',()=>{
 it('retains all twelve sidebar links outside the desk',()=>{
  pathname='/tools';render(<SiteNavigationFrame><p>Tools content</p></SiteNavigationFrame>);
  const nav=screen.getByRole('navigation',{name:'Sections'});
  expect(within(nav).getAllByRole('link')).toHaveLength(12);
  expect(within(nav).getByRole('link',{name:'Starting Soon'})).toHaveAttribute('href','/?board=soon&filter=popular');
  expect(within(nav).getByRole('link',{name:'Invite'})).toHaveAttribute('href','/invite');
  expect(within(nav).getByRole('link',{name:'Partners'})).toHaveAttribute('href','/partners');
 });
 it('adds «News» to the More group only while the news is on, pointing at the section on /blog, marked current there',()=>{
  newsFeed={state:'ok'};pathname='/blog';render(<SiteNavigationFrame><p>Blog</p></SiteNavigationFrame>);
  const nav=screen.getByRole('navigation',{name:'Sections'});
  expect(within(nav).getAllByRole('link')).toHaveLength(13);
  const news=within(nav).getByRole('link',{name:'News'});
  expect(news).toHaveAttribute('href','/blog#news');
  expect(news).toHaveAttribute('aria-current','true');
  expect(news.compareDocumentPosition(within(nav).getByRole('link',{name:'Track record'})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(nav).getByRole('link',{name:'Live scores'}).compareDocumentPosition(news) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  newsFeed={state:'off'};
 });
 it('places the desk sidebar beside content, outside the existing header',()=>{
  pathname='/history';
  render(<SiteNavigationFrame><header data-testid="desk-header"/><SitePageNavigation><h1>History</h1></SitePageNavigation></SiteNavigationFrame>);
  expect(screen.getAllByRole('navigation',{name:'Sections'})).toHaveLength(1);
  expect(screen.queryByTestId('shared-header')).not.toBeInTheDocument();
  expect(screen.getByTestId('desk-header').closest('.br-site-page')).toBeNull();
  expect(screen.getByRole('heading',{name:'History'}).closest('.br-site-page')).toContainElement(screen.getByRole('navigation',{name:'Sections'}));
 });
 it('offers real links for every primary destination',()=>{
  render(<ClassicPrimaryNav active="football"/>);
  expect(screen.getAllByRole('link')).toHaveLength(5);
  expect(screen.getByRole('link',{name:'Football'})).toHaveAttribute('href','/predictions?view=football');
  expect(screen.getByRole('link',{name:'Football'})).toHaveAttribute('aria-current','page');
  expect(screen.getByRole('link',{name:'Home'})).toHaveAttribute('href','/');
 });
 it('does not duplicate the sidebar on the home lobby and applies shared-link filters',()=>{
  pathname='/';window.history.replaceState(null,'','/?board=soon&filter=tennis');
  render(<SiteNavigationFrame><ClassicLobby lang="en" tz="UTC" football={[]} tennis={[]} renderCard={()=>null} banners={{board:{href:'/predictions'},live:{href:'/predictions?view=live'},record:{href:'/history'}}}/></SiteNavigationFrame>);
  expect(screen.getAllByRole('navigation',{name:'Sections'})).toHaveLength(1);
  expect(screen.getByRole('tab',{name:'Starting Soon'})).toHaveAttribute('aria-selected','true');
  expect(within(screen.getByRole('group',{name:'Sports'})).getByRole('button',{name:/Tennis/})).toHaveAttribute('aria-pressed','true');
  window.history.replaceState(null,'','/');
 });
});
