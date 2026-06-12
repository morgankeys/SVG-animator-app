import { createBridge } from './bridge';

/** Build an attached iframe and write markup into its about:blank document. */
function makeIframe(bodyHtml: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  iframe.contentDocument!.body.innerHTML = bodyHtml;
  return iframe;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('bridge.highlight', () => {
  it('marks the resolved element and injects the selection style once', () => {
    const iframe = makeIframe('<svg><g><circle id="ball"/></g></svg>');
    const bridge = createBridge(iframe);
    const doc = iframe.contentDocument!;

    bridge.highlight('0/0/0');
    bridge.highlight('0/0/0');
    expect(doc.getElementById('ball')!.hasAttribute('data-app-selected')).toBe(true);
    expect(doc.querySelectorAll('style').length).toBe(1);
  });

  it('moves the mark on re-highlight and clears on null', () => {
    const iframe = makeIframe('<svg><rect id="a"/><circle id="b"/></svg>');
    const bridge = createBridge(iframe);
    const doc = iframe.contentDocument!;

    bridge.highlight('0/0');
    bridge.highlight('0/1');
    expect(doc.getElementById('a')!.hasAttribute('data-app-selected')).toBe(false);
    expect(doc.getElementById('b')!.hasAttribute('data-app-selected')).toBe(true);

    bridge.highlight(null);
    expect(doc.querySelectorAll('[data-app-selected]').length).toBe(0);
  });
});

describe('bridge.onSelect', () => {
  it('reports clicked elements as refs and empty space as null', () => {
    const iframe = makeIframe('<svg><g><circle id="ball"/></g></svg>');
    const bridge = createBridge(iframe);
    const doc = iframe.contentDocument!;
    const seen: Array<string | null> = [];
    bridge.onSelect((ref) => seen.push(ref));

    doc.getElementById('ball')!.dispatchEvent(new Event('click', { bubbles: true }));
    doc.body.dispatchEvent(new Event('click', { bubbles: true }));
    expect(seen).toEqual(['0/0/0', null]);
  });

  it('stops reporting after unsubscribe', () => {
    const iframe = makeIframe('<svg></svg>');
    const bridge = createBridge(iframe);
    const seen: Array<string | null> = [];
    const unsubscribe = bridge.onSelect((ref) => seen.push(ref));
    unsubscribe();
    iframe.contentDocument!.body.dispatchEvent(new Event('click'));
    expect(seen).toEqual([]);
  });
});
