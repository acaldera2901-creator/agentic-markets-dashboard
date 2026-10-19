import {vi,it,expect,beforeAll} from 'vitest';
import {render,screen,fireEvent,within} from '@testing-library/react';
import {MobileNavigation} from './MobileNavigation';
beforeAll(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new Event('close'));};
});
it('opens complete navigation, closes it and restores focus to its trigger',()=>{
 render(<MobileNavigation lang="it" groups={[{title:'Sport',items:[['/?board=all&filter=tennis','Tennis','classic-tennis']]}]}/>);
 const trigger=screen.getByRole('button',{name:'Menu'});
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 fireEvent.click(trigger);
 const menu=screen.getByRole('dialog',{name:'Menu'});
 expect(within(menu).getByRole('link',{name:'Tennis'})).toHaveAttribute('href','/?board=all&filter=tennis');
 expect(within(menu).getByRole('link',{name:'Account e abbonamento'})).toHaveAttribute('href','/plans');
 fireEvent.click(within(menu).getByRole('button',{name:'Chiudi menu'}));
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 expect(trigger).toHaveFocus();
 expect(trigger).toHaveAttribute('aria-expanded','false');
});
