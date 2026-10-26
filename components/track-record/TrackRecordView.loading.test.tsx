import {render,screen} from '@testing-library/react';
import {it,expect} from 'vitest';
import {TrackRecordView} from './TrackRecordView';
it('shows loading rather than a false empty history before the first response',()=>{
 render(<TrackRecordView rows={[]} data={{stats:null,segments:[]}} loading lang="en" />);
 expect(screen.getByText('Loading verified results…')).toBeInTheDocument();
 expect(screen.getByText('Loading statistics…')).toBeInTheDocument();
 expect(screen.queryByText('Settled picks will appear here as matches finish.')).not.toBeInTheDocument();
});

it('does not disguise an API failure as an empty track record',()=>{
 render(<TrackRecordView rows={[]} data={{stats:null}} error lang="en" />);
 expect(screen.getByRole('alert')).toHaveTextContent('Could not refresh results');
 expect(screen.queryByText('Settled picks will appear here as matches finish.')).not.toBeInTheDocument();
});
