import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {NewsActions} from './NewsActions';
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
const state={likes:4,commentCount:0,liked:false,authenticated:true,comments:[]};
it('persists a like and reloads real count',async()=>{const f=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>state}).mockResolvedValueOnce({ok:true}).mockResolvedValueOnce({ok:true,json:async()=>({...state,likes:5,liked:true})});vi.stubGlobal('fetch',f);render(<NewsActions guid={'a'.repeat(64)} title="News" lang="en"/>);const like=await screen.findByRole('button',{name:/Like/});await waitFor(()=>expect(screen.getByText('4')).toBeTruthy());fireEvent.click(like);await waitFor(()=>expect(screen.getByText('5')).toBeTruthy());expect(JSON.parse(f.mock.calls[1][1].body)).toMatchObject({action:'like',liked:true});expect(screen.getByRole('button',{name:/Unlike/}).getAttribute('aria-pressed')).toBe('true')});
it('unavailable API is not shown as zero engagement',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));render(<NewsActions guid={'a'.repeat(64)} title="News" lang="en"/>);expect(await screen.findByText(/temporarily unavailable/)).toBeTruthy();expect(screen.queryByText('0')).toBeNull()});
