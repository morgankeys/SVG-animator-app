import { linkNodes, unlinkMember, setCanonicalId, setStatus, findCorrespondence } from './mapping';
import type { Correspondence } from './match';

/** A small hand-built correspondence set across two frames "a" and "b". */
function base(): Correspondence[] {
  return [
    { id: 'circle', members: { a: '0/0', b: '0/0' }, confidence: 0.9, status: 'auto' },
    { id: 'rect', members: { a: '0/1' }, confidence: 0, status: 'unmatched' },
    { id: 'shadow', members: { b: '0/1' }, confidence: 0, status: 'unmatched' },
  ];
}

describe('findCorrespondence', () => {
  it('locates the correspondence holding a given frame node', () => {
    const corrs = base();
    expect(findCorrespondence(corrs, 'a', '0/0')!.id).toBe('circle');
    expect(findCorrespondence(corrs, 'b', '0/1')!.id).toBe('shadow');
    expect(findCorrespondence(corrs, 'a', '9/9')).toBeUndefined();
  });
});

describe('linkNodes', () => {
  it('links two unmatched singletons into one correspondence', () => {
    const result = linkNodes(base(), 'a', '0/1', 'b', '0/1');
    const rect = result.find((c) => c.members.a === '0/1');
    expect(rect!.members).toEqual({ a: '0/1', b: '0/1' });
    expect(rect!.status).toBe('manual');
    // shadow's singleton is consumed (it had only the b member).
    expect(result.find((c) => c.id === 'shadow' && c.members.b === '0/1')).toBeUndefined();
  });

  it('displaces an existing member to its own unmatched singleton', () => {
    // circle already maps a:0/0 <-> b:0/0. Re-link a:0/0 to b:0/1 (shadow).
    const result = linkNodes(base(), 'a', '0/0', 'b', '0/1');
    const circle = result.find((c) => c.id === 'circle');
    expect(circle!.members).toEqual({ a: '0/0', b: '0/1' });
    // The old b:0/0 node isn't lost — it's split off as a new unmatched singleton.
    const orphan = result.find((c) => c.members.b === '0/0');
    expect(orphan).toBeDefined();
    expect(orphan!.status).toBe('unmatched');
    expect(orphan!.id).not.toBe('circle');
  });

  it('is a no-op when both nodes are already the same correspondence', () => {
    const corrs = base();
    expect(linkNodes(corrs, 'a', '0/0', 'b', '0/0')).toEqual(corrs);
  });

  it('is a no-op for two nodes in the same frame', () => {
    const corrs = base();
    expect(linkNodes(corrs, 'a', '0/0', 'a', '0/1')).toEqual(corrs);
  });

  it('keeps generated singleton ids unique', () => {
    const result = linkNodes(base(), 'a', '0/0', 'b', '0/1');
    const ids = result.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('unlinkMember', () => {
  it('splits a member off into its own unmatched singleton', () => {
    const result = unlinkMember(base(), 'circle', 'b');
    const circle = result.find((c) => c.id === 'circle');
    expect(circle!.members).toEqual({ a: '0/0' });
    expect(circle!.status).toBe('manual');
    const orphan = result.find((c) => c.members.b === '0/0' && c.id !== 'circle');
    expect(orphan!.status).toBe('unmatched');
  });

  it('drops a correspondence that becomes empty', () => {
    const result = unlinkMember(base(), 'rect', 'a');
    // rect had only the a member; removing it leaves a single unmatched singleton.
    expect(result.find((c) => c.id === 'rect')).toBeUndefined();
    expect(result.some((c) => c.members.a === '0/1')).toBe(true);
  });

  it('is a no-op for an unknown id or frame', () => {
    const corrs = base();
    expect(unlinkMember(corrs, 'nope', 'a')).toEqual(corrs);
    expect(unlinkMember(corrs, 'circle', 'z')).toEqual(corrs);
  });
});

describe('setCanonicalId / setStatus', () => {
  it('renames a correspondence and promotes auto → manual', () => {
    const result = setCanonicalId(base(), 'circle', 'ball');
    const c = result.find((c) => c.members.a === '0/0')!;
    expect(c.id).toBe('ball');
    expect(c.status).toBe('manual');
  });

  it('sets a frame-specific status without touching members', () => {
    const result = setStatus(base(), 'shadow', 'frame-specific');
    const c = result.find((c) => c.id === 'shadow')!;
    expect(c.status).toBe('frame-specific');
    expect(c.members).toEqual({ b: '0/1' });
  });
});
