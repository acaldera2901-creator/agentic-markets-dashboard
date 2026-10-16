import {it,expect,vi,afterEach} from 'vitest';
import {render,screen} from '@testing-library/react';
import {useYearData,YearDataContext} from './useYearData';
afterEach(()=>vi.unstubAllGlobals());
function Reader(){const a=useYearData('');const b=useYearData('segments');return <p>{a?.stats?.won ?? 'loading'}:{b?.segments?.length ?? 'loading'}</p>}
it('reuses parent history data for summary and segments, including during loading',()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 const view=render(<YearDataContext.Provider value={null}><Reader/></YearDataContext.Provider>);
 expect(fetcher).not.toHaveBeenCalled();
 view.rerender(<YearDataContext.Provider value={{stats:{won:42},segments:[]}}><Reader/></YearDataContext.Provider>);
 expect(screen.getByText('42:0')).toBeInTheDocument();expect(fetcher).not.toHaveBeenCalled();
});
