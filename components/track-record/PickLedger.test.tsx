import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { PickLedger } from './PickLedger';
it('shows the verified score independently of paid prediction access', () => {
 render(<PickLedger lang="it" rows={[{sport:'tennis',competition:'ATP',home_team:'A',away_team:'B',pick:null,result:'lost',starts_at:'2026-11-10',locked:true,final_score:'6-4 6-3'}]} />);
 expect(screen.getByText(/6-4 6-3/)).toBeTruthy();
 expect(screen.getByText(/vincitore per primo/)).toBeTruthy();
});
