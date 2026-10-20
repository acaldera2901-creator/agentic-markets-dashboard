import {describe,it,expect,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import {InvitePage} from './InvitePage';
vi.mock('./AffiliateSection',()=>({AffiliateSection:()=> <div>Real affiliate account</div>}));
vi.mock('@/components/classic/ClassicInvite',()=>({ClassicInvite:({v2}:{v2:boolean})=> <div>{v2?'Demo balances':'Referral account'}</div>}));
describe('Invite page routing',()=>{
 it('uses the real affiliate panel when both classic and affiliate are enabled',async()=>{
 render(<InvitePage classic affiliate lang="it" onSignIn={()=>{}} onRegister={()=>{}} legacy={<p>Legacy</p>}/>);
 expect(await screen.findByText('Real affiliate account')).toBeInTheDocument();
 expect(screen.queryByText('Demo balances')).not.toBeInTheDocument();
 });
 it('preserves real referral links until affiliate activation',()=>{
 render(<InvitePage classic affiliate={false} lang="it" onSignIn={()=>{}} onRegister={()=>{}} legacy={<p>Legacy</p>}/>);
 expect(screen.getByText('Referral account')).toBeInTheDocument();
 });
});
