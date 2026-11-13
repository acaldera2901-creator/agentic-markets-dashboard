"""Audit or recover a bounded batch of published results. Default: read-only.

python -m scripts.recover_published_results [--after UUID] [--limit 100] [--apply]
"""
import argparse
import asyncio
import json
import logging
from agents.tennis_settlement import TennisSettlementAgent
from core.published_result_recovery import read_published_batch, resolve_published_batch, apply_recovered_result

async def main(args):
    rows = await read_published_batch(args.after, args.limit)
    agent = object.__new__(TennisSettlementAgent)
    agent.logger = logging.getLogger('result-recovery')
    plans = await resolve_published_batch(rows, agent._resolve_published_sources)
    applied = 0
    if args.apply:
        for plan in plans:
            applied += bool(await apply_recovered_result(plan))
    print(json.dumps({'scanned': len(rows), 'recoverable': len(plans), 'applied': applied,
                      'next_cursor': rows[-1]['id'] if len(rows) == args.limit else None,
                      'plans': plans}, default=str))

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--after')
    p.add_argument('--limit', type=int, default=100, choices=range(1,101), metavar='1..100')
    p.add_argument('--apply', action='store_true')
    asyncio.run(main(p.parse_args()))
