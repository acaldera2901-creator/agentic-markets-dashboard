import {describe,it,expect} from 'vitest';
import {isDeskPath,hasPublicNavigation,lobbyDestination,readLobbyDestination} from './site-navigation';
describe('persistent site navigation destinations',()=>{
 it('covers public destinations without wrapping admin or embeds',()=>{for(const p of ['/','/plans','/history','/tools','/partners','/privacy','/reset-password'])expect(hasPublicNavigation(p)).toBe(true);expect(hasPublicNavigation('/admin/blog')).toBe(false);expect(isDeskPath('/history')).toBe(true);expect(isDeskPath('/tools')).toBe(false);});
 it('round trips each sidebar filter and rejects unknown values',()=>{for(const board of ['featured','inplay','soon','all'])for(const filter of ['popular','football','tennis'])expect(readLobbyDestination(lobbyDestination(board,filter).split('?')[1])).toEqual({board,filter});expect(readLobbyDestination('?board=bad&filter=bad')).toEqual({board:'featured',filter:'popular'});});
});
