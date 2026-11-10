import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {HomeAuthModal} from '@/components/auth/HomeAuthModal';
afterEach(cleanup);
it('news access opens a dialog outside the isolated site content and can close',()=>{
 const close=vi.fn();const {container}=render(<div style={{isolation:'isolate'}}><HomeAuthModal newsHero intent="login" lang="en" onClose={close}/></div>);
 expect(screen.getByRole('dialog')).toBeTruthy();expect(container.querySelector('.av-backdrop')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Close'}));expect(close).toHaveBeenCalledOnce();
});
