import {it,expect,vi,afterEach} from 'vitest';
import {renderHook,act} from '@testing-library/react';
import {usePolledTask} from './use-polled-task';
afterEach(()=>vi.useRealTimers());
it('does not load inactive page data; starts and stops polling on navigation',async()=>{
 vi.useFakeTimers();const task=vi.fn(async()=>{});
 const view=renderHook(({enabled})=>usePolledTask(task,1000,enabled),{initialProps:{enabled:false}});
 await act(async()=>{await vi.advanceTimersByTimeAsync(2000)});expect(task).not.toHaveBeenCalled();
 view.rerender({enabled:true});await act(async()=>{await vi.advanceTimersByTimeAsync(0)});expect(task).toHaveBeenCalledTimes(1);
 await act(async()=>{await vi.advanceTimersByTimeAsync(1000)});expect(task).toHaveBeenCalledTimes(2);
 view.rerender({enabled:false});await act(async()=>{await vi.advanceTimersByTimeAsync(2000)});expect(task).toHaveBeenCalledTimes(2);
});
